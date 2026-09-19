import { and, eq, sql } from "drizzle-orm";
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
 * attempts its cost row, tagged by run so the sample stays apart from the
 * product path (D-003). Attempts rather than writes: `recordCost` never
 * throws, because the worksheet must not destroy a paid answer, so a row
 * that cannot be written is printed with COST_NOT_RECORDED and dropped. A
 * missing row is an accounting gap and is never a call that cost nothing.
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
 * its resume for the review screen and nothing else. Submission does not
 * ship before the screen that resolves a held packet exists (D-017).
 *
 * **An invalid or a failed packet may have a resume too, and this comment
 * used to say it had none** (the ninth review's item 6). A rejection blocks
 * a document and does not delete it (D-038); an answer that parsed and
 * threw the validator keeps its document on a `failed` row (D-045); and a
 * run that produced nothing leaves the previous run's document where it is
 * (D-051). That is the whole reason this function is a status test and not
 * a null test: the status is what stops a document being served, and the
 * absence of a document is not.
 */
export function consumableResume(p: { status: string; resume: ResumeDocument | null }): ResumeDocument | null {
  return p.status === "ready" ? p.resume : null;
}

/**
 * What to say about where the row's artifact came from, in one sentence, or
 * null when this execution simply wrote its own packet with a document and
 * there is nothing worth saying.
 *
 * **It lives here, beside the enumeration, and is exported so a test asserts
 * the sentence** (the tenth review's item 1). The wrong string is the user
 * facing half of that defect: the CLI told a reader that the row kept an
 * artifact an earlier execution left, on rows where no artifact existed at
 * all. An enumeration that is right and a sentence that is wrong is the same
 * defect as before, one layer out.
 *
 * `row` is the stored row, which is the only thing that can say whether a
 * document exists. `storedAs` never answers that and is not asked to.
 */
export function describeStorage(out: Pick<TailorOutcome, "storedAs" | "resume">, row: { resume: ResumeDocument | null }): string | null {
  if (out.storedAs === "none") return "nothing was written to the row: this execution ran with storing off.";
  if (out.storedAs === "packet") {
    if (out.resume) return null;
    return "this execution produced no document and no stored packet matched its inputs, so the row it wrote is this execution's own and holds no document.";
  }
  if (row.resume) {
    return "this execution produced no document, so the row keeps the artifact an earlier execution left and only the error moved (D-051). Everything below describes that earlier artifact, not the execution above.";
  }
  return "this execution produced no document, and the row it left alone holds none either, so there was no artifact to preserve. The labels below are an earlier execution's and the error is this one's (D-051).";
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

/**
 * What one call to `tailorJob` did. **It describes this execution and not the
 * stored packet**, and the two differ on purpose: a run that produced no
 * document leaves an earlier run's document on the row (D-051), so `resume`
 * here is null while the row still has one. Nothing may read this object to
 * answer "what would be served for this job"; that question is asked of the
 * row, through `consumableResume` (D-051).
 */
export interface TailorOutcome {
  jobId: string;
  /** This execution's outcome, not necessarily the stored row's. */
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
  /** The document this execution produced, null when it produced none. Not the row's document. */
  resume: ResumeDocument | null;
  /**
   * **What was written to the row, and nothing else.** Every value is decided
   * by what the code did, never by whether a document exists.
   *
   *   packet  this execution wrote the row's artifact columns: status, mode,
   *           model, run, attempts, findings, change set, attempt number,
   *           validator revision, and the document if it produced one. The
   *           row is this execution's. **It may hold no document**, which is
   *           what a first execution that produced nothing looks like.
   *   kept    this execution produced no document and a row with the same
   *           user, job, facts hash and content hash already existed, so that
   *           row's artifact columns were left untouched and only `error` and
   *           `updated_at` moved (D-051). **Whether the surviving artifact
   *           holds a document is a separate question and this does not
   *           answer it.**
   *   none    nothing was written, because `store` was false.
   *
   * The first shape of this field was `artifact | execution | none` and was
   * **wrong in both directions** (the tenth review's item 1). It read
   * "artifact" whenever the update matched nothing, including when this
   * execution had produced no document at all, under a doc saying "it
   * produced a document"; and it read "execution" whenever the update
   * matched, including when the row it left alone held no document either,
   * under a doc saying an artifact was kept. The second case is the ninth
   * review's finding 3, so the signal built to replace an inference was
   * inferring the same thing one layer down. These three say only what was
   * written, and a caller that needs to know whether a document exists asks
   * the row.
   */
  storedAs: "packet" | "kept" | "none";
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
    storedAs: "none",
    ...totals,
    usd: Number(totals.usd.toFixed(8)),
  };
  if (store) {
    /*
     * A run that produced no document keeps the one already on the row, and D-045 kept only the document.
     *
     * That was not enough and the comment that stood here said the opposite of what the code did. Everything that
     * describes the kept document, its change set, its findings, its attempt number, the validator revision it
     * passed under, the run and model that produced it, was overwritten with the failed run's values, so the row
     * held run A's document under run B's labels with `change_set` null: not replayable, not attributable, and
     * described as belonging to a run that produced nothing (the eighth review's finding 1).
     *
     * So the split is between the artifact and the execution, and every column belongs to one of them.
     *
     *   the artifact   status, mode, model, run, attempts, resume, resumeHash, changes, findings, changeSet,
     *                  attempt, validatorRev, tokens, usd, ms. These move together or not at all.
     *   the execution  error and updatedAt, which are this run's whatever happened, so the row records that a
     *                  later execution was attempted and failed.
     *
     * When this run produced a document it owns the row and every column is its own. When it produced none and a
     * row with the same facts hash and content hash exists, that row's artifact columns are left untouched and only
     * the execution columns move. When it produced none and no such row exists, either because there is no row or
     * because an input has moved, the full write below runs and the stored document, which answered a different
     * question, goes with it (D-051).
     *
     * The cost of this run is not lost by leaving `usd` alone, **as long as its cost rows were written**. That is
     * not a guarantee and this comment used to state it as one. `recordCost` never throws: a row that cannot be
     * written is printed with COST_NOT_RECORDED and dropped, deliberately, so a paid and validated answer is not
     * destroyed by the worksheet (review four, finding 16). So a preserved row's spend is recoverable from
     * `cost_events` when the rows are there, and when one is missing the spend is **unaccounted for, never zero**.
     * Anything computing a cost per attempted packet has to establish coverage first and report the unresolved
     * portion separately (the ninth review's finding 9).
     */
    // Written as two statements rather than one upsert with a condition per column, because the condition is the
    // same for every artifact column and the row either keeps all of them or none.
    const keptArtifact = resume
      ? []
      : await db
          .update(packets)
          .set({ error: error ?? null, updatedAt: sql`now()` })
          .where(and(eq(packets.userId, facts.userId), eq(packets.jobId, job.id), eq(packets.factsHash, facts.factsHash), eq(packets.contentHash, contentHash)))
          .returning({ id: packets.id });
    // Which of the two happened, recorded from the write itself. Set inside each branch rather than from the
    // length beforehand, so neither value can be reached by a path that did not do what it names.
    if (keptArtifact.length) outcome.storedAs = "kept";
    if (!keptArtifact.length) {
      outcome.storedAs = "packet";
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
          updatedAt: sql`now()`,
        },
      });
    }
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
