import { sql } from "drizzle-orm";
import type { DbPool, Tx } from "@/db/client";
import { packets, type PacketFinding, type ResumeDocument } from "@/db/schema";
import { recordCost } from "@/server/cost";
import { env } from "@/lib/env";
import { resumeFacts, type ResumeFacts } from "@/server/match/profile";
import { loadScoringJobs } from "@/server/match/run";
import type { ScoringJob } from "@/server/match/score";
import { applyChanges, applyDocument, baseResume, factEntries, resumeHash, type Applied, type ChangeSet } from "./resume";
import { parseChanges, parseDocument, tailorCall, TailorError, type TailorMode, type TailorResult } from "./tailor";
import { classifyRetry, describeRetry, explicitOf, mergeRetry, retryFinding, type Explicit, type RetryClassification } from "./retry";
import { lemmasOf } from "./entities";
import { actionable, factSet, isHard, needsReview, validateChangeSet, VALIDATOR_REVISION } from "./validate";

/*
 * One packet: facts and posting in, a validated tailored resume out, or an
 * invalid packet with the findings that stopped it. The model is called at
 * most twice: once, and once more with the hard findings if the first
 * answer was rejected. A second rejection is stored as invalid. Every call
 * writes its cost row, tagged by run so the sample stays apart from the
 * product path (D-003).
 *
 * Each attempt owns its candidate, its findings and its outcome. The packet
 * is the retained attempt, usually the last, and it stores that attempt's
 * complete change set, summary and skill order included, its number and
 * the validator revision it passed or failed under, so a replay can read
 * the whole candidate again and every report can say which attempt it
 * describes (review four, findings 2 and 13). A resume is stored whenever
 * that attempt parsed, rejected or not: a rejection blocks the document, it
 * does not delete it, and `consumableResume` is the one door it would have
 * to leave through (D-038).
 *
 * The retained attempt is the last one that produced a document, not simply
 * the last one. An attempt whose call never returned, or whose answer did not
 * parse, produced nothing, and taking it as the packet deleted the document
 * the attempt before it had produced: D-038 fixed the rejection path and left
 * this one, so "invalid, then the retry times out" still cleared the row
 * (D-045). The execution failure is recorded in the error text and on the
 * attempt log, which is where a failure belongs, rather than by destroying
 * the evidence of what the model actually wrote.
 *
 * Nothing from a rejected attempt is reused: a rejected candidate cannot
 * become ready because the retry failed to parse, timed out or came back
 * incomplete. Its status stays what the validator gave it and
 * `consumableResume` serves a ready packet only. The earlier attempts stay in
 * the error text for diagnostics.
 *
 * A held answer earns a retry too when its findings are ones the model can
 * act on, each naming the word to replace (D-022). That retry is asked to
 * substitute the cited fact's own word, never to drop the line. If it comes
 * back ready or held, the packet is the retry; if it comes back rejected or
 * fails, the packet stays the held first answer, which was validated and is
 * lost by nothing.
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
 * consumable. invalid: a hard finding after the retry, with its resume
 * stored and not consumable either (D-038). failed: the call did not
 * return, or what it returned did not parse, or the validator threw on it.
 *
 * A failed attempt has a document only in the last of those three: the
 * answer parsed and nothing read it. The other two produced nothing to
 * keep. Either way the packet keeps the last document any attempt produced
 * rather than the last attempt's absence of one (D-045).
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
  /** What this attempt did to the answer before it, in words, on a retry that parsed (finding 14). */
  retry?: string;
}

export interface TailorOutcome {
  jobId: string;
  status: AttemptOutcome;
  mode: TailorMode;
  attempts: number;
  /** Every attempt in order; `status`, `findings`, `changes` and `resume` are the retained one's. */
  attemptLog: TailorAttempt[];
  /** Each attempt's parsed change set, null where it did not parse, aligned with `attemptLog`. In memory only, for a measurement that re-validates the same answers under another rule. */
  changeSets: (ChangeSet | null)[];
  /** The index of the retained attempt in `attemptLog` and `changeSets`: the last, unless a held answer's retry came back rejected or failed. */
  selected: number;
  /** The retained attempt's complete change set, what the packet stores; null when it did not parse. */
  changeSet: ChangeSet | null;
  /** The job's posting lemmas the validator saw. */
  posting: Set<string>;
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

/**
 * What the model returned, read into a change set, or the parse error.
 *
 * `explicit` is what the answer spoke about, and it is read here rather than
 * off the change set because the two differ in document mode: that answer
 * returns every line and the change set it produces holds only the lines whose
 * text differs from the base, so a line returned at the resume's own text
 * looks unspoken when it was the most deliberate thing in the answer (D-039).
 */
function readAnswer(mode: TailorMode, text: string, base: ResumeDocument): { cs: ChangeSet; applied: Applied; explicit: Explicit } {
  if (mode === "changes") {
    const cs = parseChanges(text);
    return { cs, applied: applyChanges(base, cs), explicit: explicitOf(cs) };
  }
  const doc = parseDocument(text);
  const applied = applyDocument(base, doc);
  const cs: ChangeSet = {
    summary: doc.summary,
    summaryFacts: base.experience.map((r) => r.id),
    changes: applied.diff.filter((d) => d.bullet !== "summary").map((d) => ({ bullet: d.bullet, text: d.after, facts: d.facts })),
    skills: [],
  };
  // Every line the document answer returned against a line the resume has, whether or not it changed it.
  const lines = new Set<string>(["summary"]);
  for (const role of doc.experience) {
    const baseRole = base.experience.find((r) => r.id === role.id);
    if (!baseRole) continue;
    role.bullets.forEach((_, j) => {
      if (baseRole.bullets[j]) lines.add(`${role.id}.${j + 1}`);
    });
  }
  return { cs, applied, explicit: { lines, skillOrder: true } };
}

interface Attempt {
  n: number;
  outcome: AttemptOutcome;
  candidate: { cs: ChangeSet; applied: Applied; explicit: Explicit } | null;
  findings: PacketFinding[];
  error?: string;
  /** What this attempt did to the answer before it, on a retry that parsed. */
  retry?: RetryClassification;
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
  const base = baseResume(facts);
  const posting = lemmasOf(`${job.title}\n${job.descriptionCore}`);
  // The revision stamped on the packet is the one the posting text was read with, never a second read that ingestion may have moved on.
  const contentHash = job.contentHash;
  // A validator that throws on the facts is a code defect, and the packet records it as failed with no call made; a run that
  // aborts here would leave no row at all, a hole the cost and citation reports cannot see.
  let set: ReturnType<typeof factSet> | null = null;
  let factsError: string | null = null;
  try {
    set = factSet(entries);
  } catch (e) {
    factsError = `validator failed reading the facts: ${e instanceof Error ? e.message : String(e)}`;
  }

  const totals = { tokensIn: 0, tokensCached: 0, tokensOut: 0, usd: 0, ms: 0 };
  const cost = async (r: { usage: { inputTokens: number; cachedInputTokens: number; outputTokens: number }; usd: number; ms: number }) => {
    totals.tokensIn += r.usage.inputTokens;
    totals.tokensCached += r.usage.cachedInputTokens;
    totals.tokensOut += r.usage.outputTokens;
    totals.usd += r.usd;
    totals.ms += r.ms;
    // The worksheet is not the work: a row that cannot be written is reported and dropped, never thrown, so a paid and
    // validated answer is still stored and a failed call still reports why it failed (finding 16).
    await recordCost(db, {
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
  if (factsError) log.push({ n: 0, outcome: "failed", candidate: null, findings: [], error: factsError });
  for (let n = 1; n <= 2 && set; n += 1) {
    const previous = log[log.length - 1];
    // A rejection carries its hard findings into the retry; a held answer carries the findings the model can act on. A parse failure gets a second chance with nothing to fix.
    const retryOf =
      previous?.outcome === "invalid" ? previous.findings.filter((f) => f.level === "hard") : previous?.outcome === "needs_review" ? previous.findings.filter(actionable) : undefined;
    // The retry is given the answer it is correcting, not the findings alone. Without it the model rewrites from the
    // posting and drops lines it can no longer see; the prompt told it not to and nothing showed it what they were.
    const previousAnswer = retryOf ? (previous?.candidate?.cs ?? undefined) : undefined;
    let call: TailorResult;
    try {
      call = await tailorCall(entries, job, { mode, model, retryOf, previousAnswer });
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
    // A retry may not silently delete a line the validator did not object to: that line was validated and nothing asked
    // it to change, and dropping it is how a retry passes by removing the claim (finding 14). Such lines are put back
    // from the answer before it, and the merged set is validated whole so a restored line is read again rather than
    // trusted because it passed once. A line the retry named is its own decision and is never put back, including when
    // it named the line and wrote the resume's own text: that is the prompt's read-back reverting a claim it could not
    // support, and restoring it is how the self check and the merge came to undo each other (D-039).
    let classification: RetryClassification | null = null;
    if (previous?.candidate) {
      classification = classifyRetry(base, previous.candidate.cs, candidate.cs, previous.findings, candidate.explicit);
      const merged = mergeRetry(previous.candidate.cs, candidate.cs, classification);
      if (merged !== candidate.cs) candidate = { cs: merged, applied: applyChanges(base, merged), explicit: candidate.explicit };
    }
    let findings: PacketFinding[];
    try {
      findings = validateChangeSet(candidate.cs, base, set, posting);
    } catch (e) {
      // The same defect on a second answer would throw again; no paid retry for a code defect. The call already made keeps its cost row.
      // The candidate is kept: it parsed, and what failed is the code that was going to read it. Discarding it here
      // threw away the only copy of a paid answer to report a defect in our own validator (D-045).
      log.push({ n, outcome: "failed", candidate, findings: [], error: `validator failed: ${e instanceof Error ? e.message : String(e)}` });
      break;
    }
    // Provenance, not a defect: a soft finding never holds the packet, and it says how this answer was reached.
    if (classification) findings = [...findings, retryFinding(classification)];
    // A hard finding earns the retry, and so does a review finding the model can act on: both name what to replace. A
    // review finding that expresses uncertainty does not; a retry cannot resolve what the validator could not read, it
    // can only make the model drop the line, an omission with nobody deciding it.
    const outcome: AttemptOutcome = isHard(findings) ? "invalid" : needsReview(findings) ? "needs_review" : "ready";
    log.push({ n, outcome, candidate, findings, ...(classification ? { retry: classification } : {}) });
    if (!(outcome === "invalid" || (outcome === "needs_review" && findings.some(actionable)))) break;
  }

  // The packet is the last attempt that produced a document. A resume exists whenever that attempt parsed, whatever the
  // validator said about it: blocking consumption is the status's job, not the absence of the document (D-038). An
  // attempt that produced nothing is not the packet, because taking it as the packet deletes what the attempt before
  // it produced, which is the same deletion D-038 removed from the rejection path (D-045).
  const last = log[log.length - 1];
  const before = log[log.length - 2];
  // A retry of a held answer that came back rejected or failed does not replace it: the held answer was validated.
  const heldFirst = before?.outcome === "needs_review" && (last.outcome === "invalid" || last.outcome === "failed") ? before : null;
  const lastWithDocument = [...log].reverse().find((a) => a.candidate) ?? null;
  const final = heldFirst ?? (last.candidate ? last : (lastWithDocument ?? last));
  const status = final.outcome;
  const resume = final.candidate ? final.candidate.applied.resume : null;
  const error = last.error ? storedError(log) : undefined;
  const changes = final.candidate?.cs.changes ?? [];
  const outcome: TailorOutcome = {
    jobId: job.id,
    status,
    mode,
    attempts: log.filter((a) => a.n > 0).length,
    attemptLog: log.map((a) => ({ n: a.n, outcome: a.outcome, findings: a.findings, changes: a.candidate?.applied.diff.length ?? 0, error: a.error, ...(a.retry ? { retry: describeRetry(a.retry) } : {}) })),
    changeSets: log.map((a) => a.candidate?.cs ?? null),
    selected: log.indexOf(final),
    changeSet: final.candidate?.cs ?? null,
    posting,
    findings: final.findings,
    changes: final.candidate?.applied.diff.length ?? 0,
    resume,
    error,
    ...totals,
    usd: Number(totals.usd.toFixed(8)),
  };
  if (store) {
    // The stored document and the row's own labels move together: a run with no document of its own keeps the one
    // already on the row only when that row was built from the same facts and the same posting, so nothing is
    // relabelled as belonging to inputs it did not come from (D-045).
    const sameInputs = sql`${packets.factsHash} = ${facts.factsHash} and ${packets.contentHash} = ${contentHash}`;
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
        changeSet: final.candidate?.cs ?? null,
        attempt: final.n > 0 ? final.n : null,
        validatorRev: VALIDATOR_REVISION,
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
          // A run that produced no document at all does not overwrite one that a previous run built from the same
          // facts and the same posting: the row's own labels already describe that document, so keeping it relabels
          // nothing. When either input has moved, the stored document belonged to a different question and goes
          // (D-045). This is the whole of the regeneration case; with the retained attempt rule above, a run reaches
          // here with no document only when not one of its attempts parsed.
          resume: resume ?? sql`case when ${sameInputs} then ${packets.resume} else null end`,
          resumeHash: resume ? resumeHash(resume) : sql`case when ${sameInputs} then ${packets.resumeHash} else null end`,
          changes,
          findings: final.findings,
          changeSet: final.candidate?.cs ?? null,
          attempt: final.n > 0 ? final.n : null,
          validatorRev: VALIDATOR_REVISION,
          factsHash: facts.factsHash,
          contentHash,
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
