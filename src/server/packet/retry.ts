import type { PacketFinding, ResumeDocument } from "@/db/schema";
import { applyChanges, type ChangeSet } from "./resume";

/*
 * What a retry did to the answer before it, and what of that answer survives.
 *
 * The retry prompt says "do not drop a line, a number or a claim to pass the
 * check", and nothing enforced it. Measured on the 80 saved answers of
 * 18 September 2026, over the 45 retries the run kept as the packet: 35
 * dropped edited lines, 5 edited a different set, 3 reverted to the base
 * resume, and 2 kept every edited line as the prompt asks. 171 edited lines
 * were dropped in all, 145 of which the validator had never objected to. A
 * retry that drops a line passes the validator by deleting the claim, and
 * the packet that results is not the tailored resume anyone asked for: it is
 * the base resume with the flagged line missing, stamped ready. That is
 * review four's finding 14.
 *
 * Two things follow, and they are separate.
 *
 * 1. A line the validator did not object to is not the retry's to delete. It
 *    was validated in the first answer and nothing about it was asked to
 *    change. When the retry drops such a line, the first answer's version is
 *    put back and the merged set is validated whole, so the restored line is
 *    read again under the same rules rather than trusted because it passed
 *    once. A line the validator DID object to is never restored: the whole
 *    point of the retry was to replace it, and keeping a rejected line would
 *    reintroduce the invention.
 * 2. What the retry did is recorded, on the attempt log and as a soft
 *    finding, so a packet says how it was reached. A soft finding does not
 *    hold the packet; this is provenance, not a defect.
 */

/** What the retry did to the previous answer's edited lines. */
export type RetryKind =
  | "kept every edited line, substituted"
  | "kept every edited line and edited more"
  | "reverted to the base resume"
  | "dropped edited lines"
  | "edited a different set of lines";

export interface RetryClassification {
  kind: RetryKind;
  /** Lines the previous answer edited that the retry does not edit at all. */
  dropped: string[];
  /** Lines the previous answer edited. */
  of: number;
  /** Of the dropped lines, those the validator had no hard or review finding on, which are the ones put back. */
  clean: string[];
  /** True when the previous answer set a skill order and the retry did not. */
  droppedSkillOrder: boolean;
}

/** The bullets a change set actually changes, by the document the base gives: a change whose text equals the base's is not an edit. */
const editedBullets = (base: ResumeDocument, cs: ChangeSet): Set<string> => new Set(applyChanges(base, cs).diff.filter((d) => d.bullet !== "summary").map((d) => d.bullet));

/** The bullets the validator objected to: hard or review, never soft, which does not hold a line. */
export const objectedTo = (findings: PacketFinding[]): Set<string> =>
  new Set(findings.filter((f) => (f.level === "hard" || f.level === "review") && f.bullet).map((f) => f.bullet!));

/**
 * @param base the base resume both answers edit
 * @param previous the answer that was retried
 * @param next the retry's answer
 * @param previousFindings the validator's findings on `previous`, which say which of its lines were objected to
 */
export function classifyRetry(base: ResumeDocument, previous: ChangeSet, next: ChangeSet, previousFindings: PacketFinding[]): RetryClassification {
  const before = editedBullets(base, previous);
  const after = editedBullets(base, next);
  const dropped = [...before].filter((b) => !after.has(b));
  const objected = objectedTo(previousFindings);
  const clean = dropped.filter((b) => !objected.has(b));
  const droppedSkillOrder = previous.skills.length > 0 && next.skills.length === 0;
  const added = [...after].filter((b) => !before.has(b));
  // The retry reverted when it leaves the base resume untouched and the answer before it did not.
  const revertedToBase = after.size === 0 && !next.summary && before.size > 0;
  const kind: RetryKind = revertedToBase
    ? "reverted to the base resume"
    : dropped.length === 0
      ? added.length > 0
        ? "kept every edited line and edited more"
        : "kept every edited line, substituted"
      : added.length > 0
        ? "edited a different set of lines"
        : "dropped edited lines";
  return { kind, dropped, of: before.size, clean, droppedSkillOrder };
}

/** The sentence a classification prints, on the attempt log and in the soft finding. */
export function describeRetry(c: RetryClassification): string {
  const head =
    c.kind === "dropped edited lines" || c.kind === "edited a different set of lines"
      ? `the retry ${c.kind === "dropped edited lines" ? "dropped" : "edited a different set of lines and dropped"} ${c.dropped.length} of ${c.of} edited lines`
      : `the retry ${c.kind}`;
  const kept = c.clean.length
    ? `; ${c.clean.length} ${c.clean.length === 1 ? "line the validator had not objected to was" : "lines the validator had not objected to were"} put back from the answer before it`
    : "";
  const skills = c.droppedSkillOrder ? "; the skill order was dropped and put back" : "";
  return head + kept + skills;
}

/**
 * The retry's answer with the previous answer's clean dropped lines put back.
 * Only lines the validator did not object to are restored, and the result is
 * validated whole by the caller. The retry's own text always wins on a line
 * both answers edit.
 */
export function mergeRetry(previous: ChangeSet, next: ChangeSet, c: RetryClassification): ChangeSet {
  if (!c.clean.length && !c.droppedSkillOrder) return next;
  const restored = previous.changes.filter((ch) => c.clean.includes(ch.bullet) && !next.changes.some((n) => n.bullet === ch.bullet));
  return {
    ...next,
    changes: [...next.changes, ...restored],
    skills: c.droppedSkillOrder ? previous.skills : next.skills,
  };
}

/** The provenance finding a merged or classified retry carries. Soft: it says how the packet was reached, it does not hold it. */
export const retryFinding = (c: RetryClassification): PacketFinding => ({
  level: "soft",
  bullet: null,
  message: "this answer is a retry",
  detail: describeRetry(c),
});
