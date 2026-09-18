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
  | { kind: "revoke"; status: "invalid"; would: ReplayStatus; findings: PacketFinding[]; resume: null; coverage: ReplayCoverage }
  | { kind: "no_candidate" }
  | { kind: "no_resume"; would: ReplayStatus; findings: PacketFinding[]; coverage: ReplayCoverage };

/** The review finding a legacy row with a summary carries: the replay read its bullets and could not read its summary again. */
export const SUMMARY_NOT_REVALIDATED = "summary not revalidated: the packet stores no change set";
export const summaryNotRevalidated = (): PacketFinding => ({ level: "review", bullet: "summary", message: SUMMARY_NOT_REVALIDATED });

/** The hard finding a revoked row carries: nothing can verify the document it stored. */
export const UNVERIFIABLE_RESUME = "stored resume is not the base plus the stored changes";
export const unverifiable = (): PacketFinding => ({ level: "hard", bullet: null, message: UNVERIFIABLE_RESUME });

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
export function replayDecision(row: ReplayRow, replayed: PacketFinding[], candidate: ResumeDocument | null): ReplayDecision {
  if (row.status === "failed") return { kind: "no_candidate" };
  const coverage: ReplayCoverage = row.changeSet ? "full" : "bullets";
  // Full coverage retains nothing; bullets only keeps the summary's old findings and, when there is a summary, holds the row on it.
  const legacySummary = coverage === "bullets" && !!row.resume?.summary;
  const findings = coverage === "full" ? replayed : [...replayed, ...retainedFindings(row.findings), ...(legacySummary ? [summaryNotRevalidated()] : [])];
  const status = statusOf(findings);
  if (status === "invalid") return { kind: "restamp", status, findings, resume: null, coverage };
  if (!row.resume || !candidate || !sameDocument(row.resume, candidate)) {
    // A row that is consumable or reviewable today on a document nothing can verify is revoked; a row that is neither cannot be promoted.
    if (row.status === "ready" || row.status === "needs_review") return { kind: "revoke", status: "invalid", would: status, findings: [...findings, unverifiable()], resume: null, coverage };
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
  /** Rows refused because they moved between the read and the write. */
  stale: number;
  /** Rows the decision left alone: no candidate, or no resume to promote. */
  untouched: number;
}

/** Writes each restamp, guarded by the `updated_at` the row was read with, so a packet replaced under the report is never stamped with findings from its predecessor. */
export async function applyReplay(db: DbPool | Tx, decisions: { row: ReplayRow; decision: ReplayDecision }[]): Promise<ApplyResult> {
  const out: ApplyResult = { restamped: 0, changedStatus: 0, revoked: 0, stale: 0, untouched: 0 };
  for (const { row, decision } of decisions) {
    if (decision.kind !== "restamp" && decision.kind !== "revoke") {
      out.untouched += 1;
      continue;
    }
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
  }
  return out;
}
