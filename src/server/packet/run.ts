import { eq, sql } from "drizzle-orm";
import type { DbPool, Tx } from "@/db/client";
import { costEvents, jobs, packets, type PacketFinding, type ResumeDocument } from "@/db/schema";
import { env } from "@/lib/env";
import { resumeFacts, type ResumeFacts } from "@/server/match/profile";
import { loadScoringJobs } from "@/server/match/run";
import type { ScoringJob } from "@/server/match/score";
import { applyChanges, applyDocument, baseResume, factEntries, resumeHash, type Applied, type ChangeSet } from "./resume";
import { parseChanges, parseDocument, tailorCall, TailorError, type TailorMode, type TailorResult } from "./tailor";
import { factSet, isHard, validateChangeSet } from "./validate";

/*
 * One packet: facts and posting in, a validated tailored resume out, or an
 * invalid packet with the findings that stopped it. The model is called at
 * most twice: once, and once more with the hard findings if the first
 * answer was rejected. A second rejection is stored as invalid. Every call
 * writes its cost row, tagged by run so the sample stays apart from the
 * product path (D-003).
 *
 * Nothing here decides which jobs get a packet. In phase 0 that is the
 * sample and `npm run tailor`; in the product it is the user's apply
 * decision, never a job the user has not chosen.
 */

export interface TailorOptions {
  mode?: TailorMode;
  model?: string;
  run?: string | null;
  /** The sample's second mode writes cost rows only, never a packet. */
  store?: boolean;
}

export interface TailorOutcome {
  jobId: string;
  status: "ready" | "invalid" | "failed";
  mode: TailorMode;
  attempts: number;
  findings: PacketFinding[];
  changes: number;
  resume: ResumeDocument | null;
  error?: string;
  tokensIn: number;
  tokensCached: number;
  tokensOut: number;
  usd: number;
  ms: number;
}

/** What the model returned, read into a change set, or the parse error. */
function readAnswer(mode: TailorMode, text: string, base: ResumeDocument): { cs: ChangeSet; applied: Applied } {
  if (mode === "changes") {
    const cs = parseChanges(text);
    return { cs, applied: applyChanges(base, cs) };
  }
  const doc = parseDocument(text);
  const applied = applyDocument(base, doc);
  const cs: ChangeSet = { summary: doc.summary, changes: applied.diff.filter((d) => d.bullet !== "summary").map((d) => ({ bullet: d.bullet, text: d.after, facts: [] })), skills: [] };
  return { cs, applied };
}

export async function tailorJob(db: DbPool | Tx, facts: ResumeFacts, job: ScoringJob, opts: TailorOptions = {}): Promise<TailorOutcome> {
  const mode = opts.mode ?? "changes";
  const model = opts.model ?? env().MODEL_TAILOR ?? "gpt-5.6-luna";
  const store = opts.store ?? true;
  const entries = factEntries(facts);
  const set = factSet(entries);
  const base = baseResume(facts);
  const [jobRow] = await db.select({ contentHash: jobs.contentHash }).from(jobs).where(eq(jobs.id, job.id));
  const contentHash = jobRow?.contentHash ?? "";

  const totals = { tokensIn: 0, tokensCached: 0, tokensOut: 0, usd: 0, ms: 0 };
  const cost = async (r: { usage: { inputTokens: number; cachedInputTokens: number; outputTokens: number }; usd: number; ms: number }) => {
    totals.tokensIn += r.usage.inputTokens;
    totals.tokensCached += r.usage.cachedInputTokens;
    totals.tokensOut += r.usage.outputTokens;
    totals.usd += r.usd;
    totals.ms += r.ms;
    await db.insert(costEvents).values({
      kind: "tailor",
      model,
      userId: facts.userId,
      refId: job.id,
      tokensIn: r.usage.inputTokens,
      tokensCached: r.usage.cachedInputTokens,
      tokensOut: r.usage.outputTokens,
      usd: r.usd,
      ms: r.ms,
      run: opts.run ?? null,
    });
  };

  let attempts = 0;
  let findings: PacketFinding[] = [];
  let last: { cs: ChangeSet; applied: Applied } | null = null;
  let status: TailorOutcome["status"] = "failed";
  let error: string | undefined;
  for (attempts = 1; attempts <= 2; attempts += 1) {
    let call: TailorResult;
    try {
      call = await tailorCall(entries, job, { mode, model, retryOf: attempts === 2 ? findings.filter((f) => f.level === "hard") : undefined });
    } catch (e) {
      const err = e instanceof TailorError ? e : new TailorError(e instanceof Error ? e.message : String(e), model, null, 0, 0);
      if (err.usage) await cost({ usage: err.usage, usd: err.usd, ms: err.ms });
      error = err.message;
      status = "failed";
      break;
    }
    await cost(call);
    try {
      last = readAnswer(mode, call.text, base);
    } catch (e) {
      error = e instanceof Error ? e.message : String(e);
      status = "failed";
      // A parse failure is retried once like a rejection: the second answer gets no findings to fix, only a second chance.
      findings = [];
      continue;
    }
    findings = validateChangeSet(last.cs, base, set);
    if (!isHard(findings)) {
      status = "ready";
      break;
    }
    status = "invalid";
  }
  if (status === "failed" && last && !isHard(findings)) status = "ready";

  // Only a packet the validator passed carries a document; an invalid one keeps its changes and findings for review.
  const resume = last && status === "ready" ? last.applied.resume : null;
  const outcome: TailorOutcome = {
    jobId: job.id,
    status,
    mode,
    attempts: Math.min(attempts, 2),
    findings,
    changes: last?.applied.diff.length ?? 0,
    resume,
    error,
    ...totals,
    usd: Number(totals.usd.toFixed(8)),
  };
  if (store) {
    await db
      .insert(packets)
      .values({
        userId: facts.userId,
        jobId: job.id,
        status,
        mode,
        model,
        attempts: outcome.attempts,
        resume,
        changes: last?.cs.changes ?? [],
        findings,
        factsHash: facts.factsHash,
        contentHash,
        resumeHash: resume ? resumeHash(resume) : null,
        tokensIn: totals.tokensIn,
        tokensCached: totals.tokensCached,
        tokensOut: totals.tokensOut,
        usd: outcome.usd,
        ms: totals.ms,
        error: error?.slice(0, 500) ?? null,
      })
      .onConflictDoUpdate({
        target: [packets.userId, packets.jobId],
        set: {
          status,
          mode,
          model,
          attempts: outcome.attempts,
          resume,
          changes: last?.cs.changes ?? [],
          findings,
          factsHash: facts.factsHash,
          contentHash,
          resumeHash: resume ? resumeHash(resume) : null,
          tokensIn: totals.tokensIn,
          tokensCached: totals.tokensCached,
          tokensOut: totals.tokensOut,
          usd: outcome.usd,
          ms: totals.ms,
          error: error?.slice(0, 500) ?? null,
          updatedAt: sql`now()`,
        },
      });
  }
  return outcome;
}

/** Loads the user's facts and the job and tailors. Null when the user has no confirmed profile. */
export async function tailorForUser(db: DbPool | Tx, userId: string, jobId: string, opts: TailorOptions = {}): Promise<TailorOutcome | null> {
  const facts = await resumeFacts(db, userId);
  if (!facts) return null;
  const job = (await loadScoringJobs(db, [jobId])).get(jobId);
  if (!job) throw new Error(`job ${jobId} not found`);
  return tailorJob(db, facts, job, opts);
}
