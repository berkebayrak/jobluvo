import { and, eq, sql } from "drizzle-orm";
import type { DbPool, Tx } from "@/db/client";
import { packets, type PacketFinding, type ResumeDocument } from "@/db/schema";
import { resumeHash, shapedResume, type ChangeSet } from "./resume";
import { isHard, needsReview, VALIDATOR_REVISION } from "./validate";

/*
 * Restamping a stored packet under the rules as they stand (D-017). The
 * report replays a packet's bullet changes; this decides what the row may
 * be stamped with, from every finding the row will carry, and refuses to
 * stamp ready anything that has no validated candidate behind it.
 *
 * Three rules, each one a way the first replay went wrong:
 *
 * 1. The status is derived from the findings the row will hold, the
 *    replayed bullet findings and the summary findings kept from the
 *    original run together. The summary cannot be replayed (D-016), so
 *    its findings keep their level; a packet held or rejected by its
 *    summary alone stays held or rejected.
 * 2. A failed packet is not replayed. It has no candidate: the model never
 *    answered or the answer did not parse, and its empty change set is the
 *    absence of an answer, not a clean one.
 * 3. Ready and needs_review need the candidate: the stored resume must be
 *    the base plus the stored changes, with the summary it carries. A
 *    packet that passes today but has no such resume, an invalid one whose
 *    resume was never stored, cannot be promoted by a rule change; it needs
 *    a new run. The row is left as it is and counted.
 * 4. A ready or held row whose stored resume is missing or is not that
 *    candidate is revoked: stamped invalid with a hard finding that says
 *    so, its resume dropped, through the same guarded write. Leaving it
 *    was the way the repair failed open (review four, finding 1): the row
 *    stayed ready and consumableResume kept serving a document nothing
 *    could verify.
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
  | { kind: "no_resume"; would: ReplayStatus; findings: PacketFinding[]; coverage: ReplayCoverage };

/** The review finding a legacy row with a summary carries: the replay read its bullets and could not read its summary again. */
export const SUMMARY_NOT_REVALIDATED = "summary not revalidated: the packet stores no change set";
export const summaryNotRevalidated = (): PacketFinding => ({ level: "review", bullet: "summary", code: "summary-not-revalidated", message: SUMMARY_NOT_REVALIDATED });

/** The review finding a row carries when no profile on hand reproduces the facts it was built on. */
export const PROFILE_NOT_REPRODUCIBLE = "profile not reproducible: no fact set on hand has this packet's facts hash, so nothing on it could be revalidated";
export const profileNotReproducible = (): PacketFinding => ({ level: "review", bullet: null, code: "profile-not-reproducible", message: PROFILE_NOT_REPRODUCIBLE });

/** The review finding a row carries when the job's text has moved since the packet was written. */
export const POSTING_MOVED = "posting moved: the job's text has changed since this packet was written, so the words the model was given cannot be read again";
export const postingMoved = (): PacketFinding => ({ level: "review", bullet: null, code: "posting-moved", message: POSTING_MOVED });

/** The hard finding a revoked row carries: nothing can verify the document it stored. The document itself is kept; the status is what stops it (D-038). */
export const UNVERIFIABLE_RESUME = "stored resume is not the base plus the stored changes";
export const unverifiable = (): PacketFinding => ({ level: "hard", bullet: null, code: "unverifiable-resume", message: UNVERIFIABLE_RESUME });

/** The findings that survive a replay: the summary's, which nothing can replay. */
export const retainedFindings = (stored: PacketFinding[]): PacketFinding[] => stored.filter((f) => f.bullet === "summary");

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
  if (row.status !== "ready" && row.status !== "needs_review") return { kind: "no_candidate" };
  // The stored findings are kept beside the reason: nothing was re-read, so nothing the row already carried is withdrawn.
  return { kind: "hold", status: "needs_review", findings: [...row.findings.filter((f) => f.code !== finding.code), finding], resume: row.resume, why: finding.message };
}

/**
 * @param extra findings that hold the row whatever the replay finds, for an input the replay could not read the way the run did
 */
export function replayDecision(row: ReplayRow, replayed: PacketFinding[], candidate: ResumeDocument | null, extra: PacketFinding[] = []): ReplayDecision {
  if (row.status === "failed") return { kind: "no_candidate" };
  const coverage: ReplayCoverage = row.changeSet ? "full" : "bullets";
  // Full coverage retains nothing; bullets only keeps the summary's old findings and, when there is a summary, holds the row on it.
  const legacySummary = coverage === "bullets" && !!row.resume?.summary;
  const findings = [...(coverage === "full" ? replayed : [...replayed, ...retainedFindings(row.findings), ...(legacySummary ? [summaryNotRevalidated()] : [])]), ...extra];
  const status = statusOf(findings);
  // A restamp that rejects keeps the document it rejected. Clearing it here is what destroyed ten tailored resumes on
  // 18 September, a day before the findings that did it were demoted, and left nothing for the demotion to promote (D-038).
  if (status === "invalid") return { kind: "restamp", status, findings, resume: row.resume, coverage };
  if (!row.resume || !candidate || !sameDocument(row.resume, candidate)) {
    // A row that is consumable or reviewable today on a document nothing can verify is revoked.
    if (row.status === "ready" || row.status === "needs_review") return { kind: "revoke", status: "invalid", would: status, findings: [...findings, unverifiable()], resume: row.resume, coverage };
    // A rejected row whose resume was cleared, but which stores the change set it was built from, is rebuilt
    // from the base plus that change set and stamped on what the validator says about it now (D-037). This is
    // not a promotion on evidence nothing can check, which is what review five's finding 6 forbids: base plus
    // a stored change set is deterministic and both are on the row, so the candidate is verifiable in the only
    // sense that matters. A bullets only row stores no change set, cannot be rebuilt, and stays as it is.
    if (!row.resume && candidate && coverage === "full") return { kind: "rebuild", status, findings, resume: candidate, coverage };
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
}

/** Writes each restamp, guarded by the `updated_at` the row was read with, so a packet replaced under the report is never stamped with findings from its predecessor. */
export async function applyReplay(db: DbPool | Tx, decisions: { row: ReplayRow; decision: ReplayDecision }[]): Promise<ApplyResult> {
  const out: ApplyResult = { restamped: 0, changedStatus: 0, revoked: 0, held: 0, stale: 0, untouched: 0, rebuilt: 0 };
  for (const { row, decision } of decisions) {
    if (decision.kind !== "restamp" && decision.kind !== "revoke" && decision.kind !== "hold" && decision.kind !== "rebuild") {
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
  }
  return out;
}
