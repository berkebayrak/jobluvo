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
 *
 * Review five's finding 8 is that the rule above was read off the shape of a
 * change set rather than off what the change set does to the document, and
 * three things slipped through that gap. A tailored summary the retry did not
 * repeat was not counted as a line at all, so it vanished and the answer was
 * still described as having kept every line. A retry that wrote the base text
 * back for a tailored line dropped it just as surely as omitting it, but the
 * merge saw an entry for that line and refused to restore it while the
 * description went on claiming the line "was put back". And a skill order the
 * retry replaced with the base order was invisible, because only an empty
 * order counted as dropped. All three reproduced against this module.
 *
 * So one rule serves all of it: a line is what the applied document says it
 * is. `effectOf` applies the change set and reads the result against the
 * base, and the summary and the skill order are read the same way as any
 * bullet. Nothing is now called restored that was not restored.
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
  /** Lines the previous answer edited that the retry leaves at the base text. "summary" is one of them. */
  dropped: string[];
  /** Lines the previous answer edited, the summary counted as one. */
  of: number;
  /** Of the dropped lines, those the validator had no hard or review finding on, which are the ones put back. */
  clean: string[];
  /** True when the previous answer put the skills in an order other than the base's and the retry leaves them in the base's. */
  droppedSkillOrder: boolean;
}

/**
 * What a change set does to the base document: the lines whose text it ends
 * up changing, and the order it ends up putting the skills in. Read off the
 * applied document rather than off the change set, so a change that restates
 * the base text is not an edit however it is written, and the summary counts
 * as a line like any other (finding 8).
 */
function effectOf(base: ResumeDocument, cs: ChangeSet): { lines: Set<string>; skills: string[] } {
  const { resume } = applyChanges(base, cs);
  const baseText = new Map<string, string>();
  for (const role of base.experience) for (const b of role.bullets) baseText.set(b.id, b.text);
  const lines = new Set<string>();
  for (const role of resume.experience) for (const b of role.bullets) if (baseText.get(b.id) !== b.text) lines.add(b.id);
  if (resume.summary !== base.summary) lines.add("summary");
  return { lines, skills: resume.skills.map((s) => s.id) };
}

const sameOrder = (a: string[], b: string[]): boolean => a.length === b.length && a.every((x, i) => x === b[i]);

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
  const baseSkills = base.skills.map((s) => s.id);
  const first = effectOf(base, previous);
  const second = effectOf(base, next);
  const before = first.lines;
  const after = second.lines;
  const dropped = [...before].filter((b) => !after.has(b));
  const objected = objectedTo(previousFindings);
  const clean = dropped.filter((b) => !objected.has(b));
  // A reorder the retry leaves at the base order is dropped, whether it wrote
  // no order or wrote the base's back.
  const droppedSkillOrder = !sameOrder(first.skills, baseSkills) && sameOrder(second.skills, baseSkills);
  const added = [...after].filter((b) => !before.has(b));
  // The retry reverted when it leaves the base resume untouched, order included, and the answer before it did not.
  const revertedToBase = after.size === 0 && sameOrder(second.skills, baseSkills) && before.size > 0;
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
    ? `; ${c.clean.length} ${c.clean.length === 1 ? "line the validator had not objected to was" : "lines the validator had not objected to were"} put back from the answer before it${c.clean.includes("summary") ? ", the summary among them" : ""}`
    : "";
  const skills = c.droppedSkillOrder ? "; the skill order was dropped and put back" : "";
  return head + kept + skills;
}

/**
 * The retry's answer with the previous answer's clean dropped lines put back,
 * the summary and the skill order among them. Only lines the validator did not
 * object to are restored, and the result is validated whole by the caller. The
 * retry's own text always wins on a line both answers edit.
 *
 * A line the retry left at the base text is dropped whether it omitted the
 * line or wrote the base text back in its place, so an entry of next's for
 * such a line is a no op by construction and the previous answer's line
 * replaces it rather than being refused. That refusal is what let
 * describeRetry claim a restoration that had not happened (finding 8).
 */
export function mergeRetry(previous: ChangeSet, next: ChangeSet, c: RetryClassification): ChangeSet {
  if (!c.clean.length && !c.droppedSkillOrder) return next;
  const restore = new Set(c.clean);
  const summary = restore.has("summary");
  return {
    ...next,
    summary: summary ? previous.summary : next.summary,
    summaryFacts: summary ? previous.summaryFacts : next.summaryFacts,
    changes: [...next.changes.filter((ch) => !restore.has(ch.bullet)), ...previous.changes.filter((ch) => restore.has(ch.bullet))],
    skills: c.droppedSkillOrder ? previous.skills : next.skills,
  };
}

/** The provenance finding a merged or classified retry carries. Soft: it says how the packet was reached, it does not hold it. */
export const retryFinding = (c: RetryClassification): PacketFinding => ({
  level: "soft",
  bullet: null,
  code: "retry-provenance",
  message: "this answer is a retry",
  detail: describeRetry(c),
});
