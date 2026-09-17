import { eq, sql } from "drizzle-orm";
import type { DbPool, Tx } from "@/db/client";
import { costEvents, jobs, packets, type PacketFinding, type ResumeDocument } from "@/db/schema";
import { env } from "@/lib/env";
import { resumeFacts, type ResumeFacts } from "@/server/match/profile";
import { loadScoringJobs } from "@/server/match/run";
import type { ScoringJob } from "@/server/match/score";
import { applyChanges, applyDocument, baseResume, factEntries, resumeHash, type Applied, type ChangeSet } from "./resume";
import { parseChanges, parseDocument, tailorCall, TailorError, type TailorMode, type TailorResult } from "./tailor";
import { factSet, isHard, needsReview, validateChangeSet } from "./validate";

/*
 * One packet: facts and posting in, a validated tailored resume out, or an
 * invalid packet with the findings that stopped it. The model is called at
 * most twice: once, and once more with the hard findings if the first
 * answer was rejected. A second rejection is stored as invalid. Every call
 * writes its cost row, tagged by run so the sample stays apart from the
 * product path (D-003).
 *
 * Each attempt owns its candidate, its findings and its outcome. The packet
 * is the last attempt, and a resume is stored only when that attempt parsed
 * and passed the validator. Nothing from an earlier attempt is reused: a
 * rejected candidate cannot become ready because the retry failed to parse,
 * timed out or came back incomplete. The earlier attempts stay in the error
 * text for diagnostics.
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

/**
 * ready: parsed and passed. needs_review: parsed, no hard finding, held
 * for a person on a review finding, with its resume stored but not
 * consumable. invalid: a hard finding after the retry, no resume. failed:
 * no answer to validate.
 */
export type AttemptOutcome = "ready" | "needs_review" | "invalid" | "failed";

/**
 * The one door a packet's resume leaves through. Only a ready packet's
 * resume may be handed to anything downstream; a needs_review packet keeps
 * its resume for the review screen and nothing else, an invalid or failed
 * one has none. Submission does not ship before the screen that resolves a
 * held packet exists (D-017).
 */
export function consumableResume(p: { status: string; resume: ResumeDocument | null }): ResumeDocument | null {
  return p.status === "ready" ? p.resume : null;
}

/** One call to the model and what became of it. */
export interface TailorAttempt {
  n: number;
  outcome: AttemptOutcome;
  findings: PacketFinding[];
  changes: number;
  error?: string;
}

export interface TailorOutcome {
  jobId: string;
  status: AttemptOutcome;
  mode: TailorMode;
  attempts: number;
  /** Every attempt in order; `status`, `findings`, `changes` and `resume` are the last one's. */
  attemptLog: TailorAttempt[];
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
  const cs: ChangeSet = {
    summary: doc.summary,
    summaryFacts: base.experience.map((r) => r.id),
    changes: applied.diff.filter((d) => d.bullet !== "summary").map((d) => ({ bullet: d.bullet, text: d.after, facts: d.facts })),
    skills: [],
  };
  return { cs, applied };
}

interface Attempt {
  n: number;
  outcome: AttemptOutcome;
  candidate: { cs: ChangeSet; applied: Applied } | null;
  findings: PacketFinding[];
  error?: string;
}

/** What packets.error holds. */
export const ERROR_STORE = 500;
/** Each earlier attempt's share of it, so the last attempt's message always has the rest. */
export const TRAIL_PER_ATTEMPT = 120;

/**
 * The error text for the row: the earlier attempts as a trail, then the
 * last attempt's own message. Built to fit the store with the last message
 * whole where it matters: the cost report counts calls of unknown cost by
 * a phrase near the start of that message (UNKNOWN_COST_MARK), and a
 * truncation from the end must never cut it away. So each earlier attempt
 * is capped first and the last message gets whatever room remains, never
 * less than ERROR_STORE minus the capped trail; a parse failure that lists
 * every schema issue cannot push a later timeout out of the store.
 */
export function storedError(log: Attempt[]): string {
  const cap = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 3)}...` : s);
  const final = log[log.length - 1];
  const trail = log
    .slice(0, -1)
    .map((a) => cap(`attempt ${a.n} ${a.outcome}${a.error ? `: ${a.error}` : `: ${a.findings.filter((f) => f.level === "hard").length} hard finding(s)`}`, TRAIL_PER_ATTEMPT))
    .join(". ");
  const head = trail ? `${trail}. attempt ${final.n} failed: ` : "";
  return head + cap(final.error ?? "", ERROR_STORE - head.length);
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

  const log: Attempt[] = [];
  for (let n = 1; n <= 2; n += 1) {
    const previous = log[log.length - 1];
    // Only a rejection carries anything into the retry: the hard findings to fix. A parse failure gets a second chance with nothing to fix.
    const retryOf = previous?.outcome === "invalid" ? previous.findings.filter((f) => f.level === "hard") : undefined;
    let call: TailorResult;
    try {
      call = await tailorCall(entries, job, { mode, model, retryOf });
    } catch (e) {
      const err = e instanceof TailorError ? e : new TailorError(e instanceof Error ? e.message : String(e), model, null, 0, 0);
      if (err.usage) await cost({ usage: err.usage, usd: err.usd, ms: err.ms });
      log.push({ n, outcome: "failed", candidate: null, findings: [], error: err.message });
      break;
    }
    await cost(call);
    let candidate: Attempt["candidate"];
    try {
      candidate = readAnswer(mode, call.text, base);
    } catch (e) {
      log.push({ n, outcome: "failed", candidate: null, findings: [], error: e instanceof Error ? e.message : String(e) });
      continue;
    }
    const findings = validateChangeSet(candidate.cs, base, set);
    // Only a hard finding earns the retry: it is a contradiction the model can fix from the finding. A review
    // finding is the validator saying it could not read one side, and a retry cannot resolve that; it can only make
    // the model drop the line to be safe, an omission with nobody deciding it. So a held packet is stored as it is.
    const outcome: AttemptOutcome = isHard(findings) ? "invalid" : needsReview(findings) ? "needs_review" : "ready";
    log.push({ n, outcome, candidate, findings });
    if (outcome !== "invalid") break;
  }

  // The packet is the last attempt. A resume exists only when that attempt itself parsed and had no hard finding;
  // a held packet keeps its resume for the review screen, an invalid one keeps its changes and findings, a failed one keeps neither.
  const final = log[log.length - 1];
  const status = final.outcome;
  const resume = (final.outcome === "ready" || final.outcome === "needs_review") && final.candidate ? final.candidate.applied.resume : null;
  const error = final.error ? storedError(log) : undefined;
  const changes = final.candidate?.cs.changes ?? [];
  const outcome: TailorOutcome = {
    jobId: job.id,
    status,
    mode,
    attempts: log.length,
    attemptLog: log.map((a) => ({ n: a.n, outcome: a.outcome, findings: a.findings, changes: a.candidate?.applied.diff.length ?? 0, error: a.error })),
    findings: final.findings,
    changes: final.candidate?.applied.diff.length ?? 0,
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
        run: opts.run ?? null,
        attempts: outcome.attempts,
        resume,
        changes,
        findings: final.findings,
        factsHash: facts.factsHash,
        contentHash,
        resumeHash: resume ? resumeHash(resume) : null,
        tokensIn: totals.tokensIn,
        tokensCached: totals.tokensCached,
        tokensOut: totals.tokensOut,
        usd: outcome.usd,
        ms: totals.ms,
        error: error ?? null,
      })
      .onConflictDoUpdate({
        target: [packets.userId, packets.jobId],
        set: {
          status,
          mode,
          model,
          run: opts.run ?? null,
          attempts: outcome.attempts,
          resume,
          changes,
          findings: final.findings,
          factsHash: facts.factsHash,
          contentHash,
          resumeHash: resume ? resumeHash(resume) : null,
          tokensIn: totals.tokensIn,
          tokensCached: totals.tokensCached,
          tokensOut: totals.tokensOut,
          usd: outcome.usd,
          ms: totals.ms,
          error: error ?? null,
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
