import { and, eq, sql } from "drizzle-orm";
import type { DbPool, Tx } from "@/db/client";
import { packets, type PacketFinding, type ResumeDocument } from "@/db/schema";
import { codeOf, type FindingCode } from "./codes";
import { resumeHash, shapedResume, type ChangeSet } from "./resume";
import { isHard, needsReview, VALIDATOR_REVISION } from "./validate";

/*
 * Restamping a stored packet under the rules as they stand (D-017). The
 * report replays a packet's bullet changes; this decides what the row may
 * be stamped with, from every finding the row will carry, and refuses to
 * stamp ready anything that has no validated candidate behind it.
 *
 * The rules, each one a way an earlier replay went wrong. **Three of them
 * described behaviour this file has since stopped having, and they are
 * corrected here rather than left to be read as current** (the ninth
 * review's item 6).
 *
 * 1. The status is derived from the findings the row will hold, the
 *    replayed bullet findings and the summary findings kept from the
 *    original run together. The summary cannot be replayed (D-016), so
 *    its findings keep their level; a packet held or rejected by its
 *    summary alone stays held or rejected.
 * 2. A failed execution that produced nothing is not replayed: the model
 *    never answered or the answer did not parse, and an empty change set
 *    is the absence of an answer, not a clean one. **A failed row with a
 *    candidate is a different thing and is replayed.** The answer parsed
 *    and the validator threw on it, D-045 kept the document, and skipping
 *    it meant no restamp could ever reach the answer the validator threw
 *    on. It is read, validated and held, never promoted (D-050).
 * 3. Ready and needs_review need the candidate: the stored resume must be
 *    the base plus the stored changes, with the summary it carries. A
 *    packet that passes today but has no such resume is not stamped ready
 *    on the strength of passing. **It does not follow that it needs a new
 *    run.** A row that stores the change set it was built from rebuilds
 *    its document from base plus that change set, which is deterministic
 *    and wholly on the row (D-037), and a row that stores neither may be
 *    offered one from outside and is accepted only where its own stored
 *    changes reproduce it (D-043). Only a row that can do neither is left
 *    as it is and counted.
 * 4. A ready or held row whose stored resume is missing or is not that
 *    candidate is revoked: stamped invalid with a hard finding that says
 *    so, through the same guarded write. Leaving it was the way the repair
 *    failed open (review four, finding 1): the row stayed ready and
 *    consumableResume kept serving a document nothing could verify.
 *    **The document is kept, not dropped.** Clearing it here is what
 *    destroyed ten tailored resumes and left the demotion that followed
 *    with nothing to promote; the status is what stops a document being
 *    served, and its absence is not (D-038).
 * 6. A row that cannot be revalidated at all is held, not left alone.
 *    Two ways that happens, and the first is how the repair of #56 still
 *    failed open (review five, finding 6). When no profile on hand
 *    reproduces the packet's facts hash, there is nothing to validate
 *    against; the report called that "excluded", left the row out of the
 *    write, and a ready row stayed ready and stayed consumable. When the
 *    job's text has moved since the packet was written, the posting the
 *    validator reads is not the posting the model was given, so a stamp
 *    made from it describes a different question. Both hold the row: a
 *    review finding says which, the resume is kept for a person, and a
 *    later replay can promote it again once the input is back. Held is
 *    the right level and invalid is not: the stored resume may be
 *    perfectly good, and what is missing is the evidence to say so.
 *
 * 5. Coverage is named. A row that stores its change set is replayed
 *    whole, summary and skill order included, and nothing is retained
 *    from the original run: the stamp means "passes the rules as they
 *    stand". A row from before change sets were stored can only have its
 *    bullets replayed; its summary findings are retained, and if it has a
 *    summary at all it cannot be stamped ready by the replay, it is held
 *    with a finding that says the summary was not revalidated (review
 *    four, finding 2). A legacy row with no summary is fully covered.
 *
 * The candidate test ignores the order of the skills list: a change set
 * stores the bullet edits and not the skill order the model asked for, so
 * a rebuilt candidate cannot reproduce it. Everything else must match.
 */

export type ReplayStatus = "ready" | "needs_review" | "invalid";

export interface ReplayRow {
  id: string;
  status: string;
  resume: ResumeDocument | null;
  resumeHash: string | null;
  findings: PacketFinding[];
  /** The retained attempt's complete change set, or null on a row from before it was stored. */
  changeSet: ChangeSet | null;
  /** `updated_at` as the database prints it; the write is refused if the row moved since it was read. */
  updatedAt: string;
}

/** What the replay could read again: the whole candidate, or the bullets only on a row that stores no change set. */
export type ReplayCoverage = "full" | "bullets";

export type ReplayDecision =
  | { kind: "restamp"; status: ReplayStatus; findings: PacketFinding[]; resume: ResumeDocument | null; coverage: ReplayCoverage }
  | { kind: "revoke"; status: "invalid"; would: ReplayStatus; findings: PacketFinding[]; resume: ResumeDocument | null; coverage: ReplayCoverage }
  /** The row could not be revalidated at all, so it is held and its resume kept: not consumable, not destroyed. */
  | { kind: "hold"; status: "needs_review"; findings: PacketFinding[]; resume: ResumeDocument | null; why: string }
  | { kind: "no_candidate" }
  /** A rejected row whose resume was cleared, rebuilt from the base plus its own stored change set and stamped on what the validator says now (D-037). */
  | { kind: "rebuild"; status: ReplayStatus; findings: PacketFinding[]; resume: ResumeDocument; coverage: "full" }
  /** A rejected row with no change set to rebuild from, whose document is offered from outside and reproduced by the row's own stored changes (D-043). */
  | { kind: "repair"; status: ReplayStatus; findings: PacketFinding[]; resume: ResumeDocument; coverage: ReplayCoverage; source: string }
  | { kind: "no_resume"; would: ReplayStatus; findings: PacketFinding[]; coverage: ReplayCoverage };

/**
 * A document offered from outside the row, for a row that has none and stores
 * no change set to rebuild one from.
 *
 * It is never trusted for being where it is. It is accepted only when the
 * row's own stored changes, plus this document's own summary, reproduce it
 * exactly, which is the same test a legacy row's stored resume has to pass to
 * be restamped at all. What the outside document supplies that the row cannot
 * is the summary text, and that summary is then not revalidated, so the row is
 * held on it exactly as any other legacy row with a summary is.
 */
export interface RepairSource {
  document: ResumeDocument;
  /** Where it came from, written onto the row: a path under version control, not a description. */
  source: string;
  /** The hash that source recorded for it, written onto the row beside the source. */
  hash: string;
}

/** The review finding a legacy row with a summary carries: the replay read its bullets and could not read its summary again. */
export const SUMMARY_NOT_REVALIDATED = "summary not revalidated: the packet stores no change set";
export const summaryNotRevalidated = (): PacketFinding => ({ level: "review", bullet: "summary", code: "summary-not-revalidated", message: SUMMARY_NOT_REVALIDATED });

/**
 * True when the row has something a replay could read again: a document, or
 * the change set to rebuild one from. A `failed` row usually has neither,
 * because the call did not return or the answer did not parse. One kind of
 * failed row does: the answer parsed and the validator threw on it, and D-045
 * keeps that document rather than deleting it (D-050).
 */
export const hasCandidate = (row: Pick<ReplayRow, "resume" | "changeSet">): boolean => !!row.resume || !!row.changeSet;

/**
 * The review finding a row carries when its **original** assessment failed:
 * the answer parsed, the validator threw, and D-045 kept the document.
 *
 * It holds the row and it is sticky. Sticky because the alternative is the
 * defect D-049 fixed one entry earlier: without it, the first pass would hold
 * the row, the finding would not be retained, and the second pass would read a
 * held row with a clean document and stamp it ready. A row whose assessment
 * failed is not promoted by a replay at all. Something with a person in it
 * decides that, and until then the row says why it is waiting.
 *
 * **The policy is right and the message used to be wrong** (the ninth review's
 * finding 7). It said nothing had ever assessed the document, on a row the
 * replay had just assessed under the current validator, using those very
 * findings to decide the status. The two are kept apart now: this finding is
 * about the historical failure and the requirement for a person, and the rest
 * of the row's findings are the latest validation result.
 *
 * **A person cannot clear this by changing the status alone.** The stickiness
 * re-derives the finding from the row's own copy of it, so a row moved to
 * `ready` by hand is held again by the next replay. Clearing it means removing
 * the finding as well, and nothing does that today. Whatever resolves a held
 * packet has to do both, and this is written here so the requirement is found
 * before it is implemented rather than after.
 *
 * **And the resolution must name the document it resolves, not the row.**
 * Recorded before anything implements it (D-069). A packet's document can be
 * replaced under it: a rerun writes a new artifact, a rebuild reconstructs one
 * from the change set, a repair restores one from a snapshot. An approval that
 * says only "this row is fine" would land on whatever the row holds when it is
 * read, which need not be what the person read. Tie it to the resume hash, or
 * to whatever version identity phase 1 item 26 gives an execution, so an
 * approval of one document cannot clear a different one.
 */
export const ASSESSMENT_NOT_RUN = "the original assessment of this answer failed, so this row is held for a person and is never promoted by a replay";
export const assessmentNotRun = (): PacketFinding => ({
  level: "review",
  bullet: null,
  code: "assessment-not-run",
  message: ASSESSMENT_NOT_RUN,
  detail: "the original assessment did not complete, so this packet needs a person; the other findings here may be a mix of the current validator's checks and historical ones kept from the run",
});

/** The review finding a row carries when no profile on hand reproduces the facts it was built on. */
export const PROFILE_NOT_REPRODUCIBLE = "profile not reproducible: no fact set on hand has this packet's facts hash, so nothing on it could be revalidated";
export const profileNotReproducible = (): PacketFinding => ({ level: "review", bullet: null, code: "profile-not-reproducible", message: PROFILE_NOT_REPRODUCIBLE });

/** The review finding a row carries when the job's text has moved since the packet was written. */
export const POSTING_MOVED = "posting moved: the job's text has changed since this packet was written, so the words the model was given cannot be read again";
export const postingMoved = (): PacketFinding => ({ level: "review", bullet: null, code: "posting-moved", message: POSTING_MOVED });

/**
 * The provenance a repaired row carries: where its document came from and what
 * hash that source recorded. Soft, like the retry's, because it says how the
 * row was reached and not that anything is wrong with it. A repaired row's
 * status is whatever the validator gives the document, the same as any other.
 */
export const REPAIRED_FROM = "resume restored from outside the row and reproduced by the row's own stored changes";
export const repairedFrom = (source: string, hash: string): PacketFinding => ({
  level: "soft",
  bullet: null,
  code: "resume-repaired",
  message: REPAIRED_FROM,
  value: source,
  detail: `the source recorded hash ${hash}`,
});

/** The hard finding a revoked row carries: nothing can verify the document it stored. The document itself is kept; the status is what stops it (D-038). */
export const UNVERIFIABLE_RESUME = "stored resume is not the base plus the stored changes";
export const unverifiable = (): PacketFinding => ({ level: "hard", bullet: null, code: "unverifiable-resume", message: UNVERIFIABLE_RESUME });

/**
 * The findings this module writes onto a row itself, rather than reading them
 * off an answer the model gave.
 *
 * A derived finding is never carried forward as though the run had written it.
 * It is dropped when the row is read again and derived afresh from the inputs
 * this pass has, which is what makes reading a row twice say the same thing.
 *
 * **This is a replacement and not a deduplication by code**, and the
 * difference matters (D-056). Findings legitimately share a code: a line with
 * three unknown values carries three `value-unknown` findings and all three
 * belong on the row. What is dropped here is the set of codes only this file
 * produces, each of which is at most one per row by construction, and every
 * finding the run wrote about the summary survives untouched.
 */
export const DERIVED_CODES = new Set<FindingCode>(["summary-not-revalidated", "assessment-not-run", "profile-not-reproducible", "posting-moved", "unverifiable-resume"]);

/** True when this row's finding was written by a previous pass of this module rather than by the run. Read through `codeOf`, so a row stored before codes existed is recognised by its message. */
export const isDerived = (f: PacketFinding): boolean => {
  const code = codeOf(f);
  return !!code && DERIVED_CODES.has(code);
};

/**
 * The findings that survive a replay: the summary's, which nothing can replay,
 * less the ones a previous pass derived.
 *
 * Without that second half the replay was not idempotent over its own output.
 * `summaryNotRevalidated` carries bullet "summary", so it was retained here and
 * a fresh copy was appended on top of it, and a legacy row with a summary gained
 * one copy per pass. The status never moved, which is why three passes agreed
 * and the test that read only the status passed (the ninth review's finding 6).
 */
export const retainedFindings = (stored: PacketFinding[]): PacketFinding[] => stored.filter((f) => f.bullet === "summary" && !isDerived(f));

/** The status a set of findings earns, the same reading the run gives a fresh attempt. */
export const statusOf = (findings: PacketFinding[]): ReplayStatus => (isHard(findings) ? "invalid" : needsReview(findings) ? "needs_review" : "ready");

const skillsSorted = (d: ResumeDocument): ResumeDocument => ({ ...shapedResume(d), skills: [...d.skills].map((s) => ({ id: s.id, text: s.text })).sort((a, b) => a.id.localeCompare(b.id)) });

/** True when the two documents are the same up to the order of the skills list. */
export const sameDocument = (a: ResumeDocument, b: ResumeDocument): boolean => resumeHash(skillsSorted(a)) === resumeHash(skillsSorted(b));

/**
 * @param row the packet as stored
 * @param replayed the validator's findings today: over the whole stored change set when the row has one, over the stored bullet changes otherwise
 * @param candidate the base plus the stored change set, or the base plus the stored changes and the stored summary on a legacy row; null when the row has no resume to rebuild
 */
/**
 * A row nothing could revalidate: held with the reason, its resume kept. A
 * failed row has nothing to hold and an invalid one is already off every
 * consumable path, so both are left where they are.
 */
export function unreplayable(row: ReplayRow, finding: PacketFinding): ReplayDecision {
  // A failed row is left exactly as it is, even when it carries a parsed candidate. Holding it would move it to
  // needs_review on the strength of not having been able to check it, and the finding that says its document was
  // never assessed would not be on the row to keep it held afterwards. Nothing is lost: the document stays and the
  // next report that can read the profile revalidates it properly (D-050).
  if (row.status !== "ready" && row.status !== "needs_review") return { kind: "no_candidate" };
  // The stored findings are kept beside the reason: nothing was re-read, so nothing the row already carried is withdrawn.
  return { kind: "hold", status: "needs_review", findings: [...row.findings.filter((f) => f.code !== finding.code), finding], resume: row.resume, why: finding.message };
}

/**
 * @param extra findings that hold the row whatever the replay finds, for an input the replay could not read the way the run did
 * @param repair a document offered from outside for a row that has none, accepted only if the row's own stored changes reproduce it (D-043)
 */
export function replayDecision(
  row: ReplayRow,
  replayed: PacketFinding[],
  candidate: ResumeDocument | null,
  extra: PacketFinding[] = [],
  repair?: RepairSource,
): ReplayDecision {
  // A failed execution that produced no answer has nothing to read again. A parsed candidate whose assessment failed
  // is a different thing and was being skipped with it: D-045 paid to keep that document and this early return meant
  // no restamp could ever reach it, so fixing the validator would never revisit the answer it threw on (D-050).
  if (row.status === "failed" && !hasCandidate(row)) return { kind: "no_candidate" };
  const coverage: ReplayCoverage = row.changeSet ? "full" : "bullets";
  // Sticky, so that reading the row twice says the same thing: once written, the finding keeps the row held on every
  // later pass rather than clearing and letting a clean document be stamped ready (D-049's shape, avoided here).
  const neverAssessed = (row.status === "failed" && hasCandidate(row)) || row.findings.some((f) => f.code === "assessment-not-run");
  // A repair is verified before any of this: the offered document counts for nothing unless the row's own stored
  // changes, plus that document's own summary, reproduce it. Nothing here trusts a file for being in the repository.
  const verified = !row.resume && repair && candidate && sameDocument(repair.document, candidate) ? repair : null;
  // Full coverage retains nothing; bullets only keeps the summary's old findings and, when there is a summary, holds the row on it.
  // A repaired row is read the same way, on the summary the offered document carries, so a restored summary is never
  // stamped as revalidated when nothing revalidated it.
  const legacySummary = coverage === "bullets" && !!(row.resume?.summary ?? verified?.document.summary);
  const findings = [
    ...(coverage === "full" ? replayed : [...replayed, ...retainedFindings(row.findings), ...(legacySummary ? [summaryNotRevalidated()] : [])]),
    ...extra,
    ...(neverAssessed ? [assessmentNotRun()] : []),
  ];
  const status = statusOf(findings);
  const repaired = (): ReplayDecision => ({
    kind: "repair",
    status,
    findings: [...findings, repairedFrom(verified!.source, verified!.hash)],
    resume: verified!.document,
    coverage,
    source: verified!.source,
  });
  // A restamp that rejects keeps the document it rejected. Clearing it here is what destroyed ten tailored resumes on
  // 18 September, a day before the findings that did it were demoted, and left nothing for the demotion to promote (D-038).
  // A verified repair attaches its document even here, for the same reason: a rejection blocks a document, it does not
  // decide whether one exists, and a row with a document and an invalid status is not a promotion.
  if (status === "invalid") return verified ? repaired() : { kind: "restamp", status, findings, resume: row.resume, coverage };
  if (!row.resume || !candidate || !sameDocument(row.resume, candidate)) {
    // A row with no document at all, which stores the change set it was built from, is rebuilt from the base plus
    // that change set and stamped on what the validator says about it now (D-037). This is not a promotion on
    // evidence nothing can check, which is what review five's finding 6 forbids: base plus a stored change set is
    // deterministic and both are on the row, so the candidate is verifiable in the only sense that matters.
    //
    // This is asked BEFORE the revoke, and the order is the whole of D-049. It used to be asked after, and the
    // revoke was guarded on the row being ready or held, so a ready row with no resume and a full change set was
    // revoked to invalid on one pass and then, being invalid, fell past the revoke into this branch on the next and
    // came back ready. Revoked on one pass, promoted on the next, over identical inputs, with the hard finding that
    // revoked it silently dropped because a replay retains only summary findings. Asking here makes the two passes
    // agree: a row that can rebuild itself does so the first time, whatever its status, and the answer is the same
    // every time it is read.
    if (!row.resume && candidate && coverage === "full") return { kind: "rebuild", status, findings, resume: candidate, coverage };
    // A row that is consumable or reviewable today on a document nothing can verify, and that cannot rebuild one
    // from itself, is revoked. A bullets only row stores no change set and is the case this still catches.
    if (row.status === "ready" || row.status === "needs_review") return { kind: "revoke", status: "invalid", would: status, findings: [...findings, unverifiable()], resume: row.resume, coverage };
    // A row with no change set cannot be rebuilt from itself, and D-037 left six of them invalid with no document. Four
    // of those six have their document in a frozen snapshot that is in version control, so the document exists and the
    // row said it did not, which is the kind of untruth this week has been spent removing. It is restored only through
    // the test above: the row's own stored changes reproduce the offered document, the validator then reads it under the
    // rules as they stand, and whatever that says is the status. Nothing is promoted by hand (D-043).
    if (verified) return repaired();
    return { kind: "no_resume", would: status, findings, coverage };
  }
  return { kind: "restamp", status, findings, resume: row.resume, coverage };
}

export interface ApplyResult {
  /** Rows written. */
  restamped: number;
  /** Of those, rows whose status changed. */
  changedStatus: number;
  /** Of those, ready or held rows revoked to invalid because their stored resume could not be verified. */
  revoked: number;
  /** Of those, rows held because nothing could revalidate them: the profile is gone or the posting moved. */
  held: number;
  /** Rows refused because they moved between the read and the write. */
  stale: number;
  /** Rows the decision left alone: no candidate, or no resume to promote. */
  untouched: number;
  /** Of those written, rows whose cleared resume was rebuilt from their own stored change set (D-037). */
  rebuilt: number;
  /** Of those written, rows whose document was restored from outside and verified against their own stored changes (D-043). */
  repaired: number;
}

/** Writes each restamp, guarded by the `updated_at` the row was read with, so a packet replaced under the report is never stamped with findings from its predecessor. */
export async function applyReplay(db: DbPool | Tx, decisions: { row: ReplayRow; decision: ReplayDecision }[]): Promise<ApplyResult> {
  const out: ApplyResult = { restamped: 0, changedStatus: 0, revoked: 0, held: 0, stale: 0, untouched: 0, rebuilt: 0, repaired: 0 };
  for (const { row, decision } of decisions) {
    if (decision.kind !== "restamp" && decision.kind !== "revoke" && decision.kind !== "hold" && decision.kind !== "rebuild" && decision.kind !== "repair") {
      out.untouched += 1;
      continue;
    }
    // A hold keeps the resume it could not verify, for the review screen, and the status stops it being consumed.
    const written = await db
      .update(packets)
      .set({
        status: decision.status,
        findings: decision.findings,
        resume: decision.resume,
        resumeHash: decision.resume ? resumeHash(decision.resume) : null,
        validatorRev: VALIDATOR_REVISION,
        updatedAt: sql`now()`,
      })
      .where(and(eq(packets.id, row.id), sql`${packets.updatedAt}::text = ${row.updatedAt}`))
      .returning({ id: packets.id });
    if (!written.length) {
      out.stale += 1;
      continue;
    }
    out.restamped += 1;
    if (row.status !== decision.status) out.changedStatus += 1;
    if (decision.kind === "revoke") out.revoked += 1;
    if (decision.kind === "hold") out.held += 1;
    if (decision.kind === "rebuild") out.rebuilt += 1;
    if (decision.kind === "repair") out.repaired += 1;
  }
  return out;
}
