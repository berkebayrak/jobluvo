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
 *
 * The sixth review's item 2 is that the restoration above outlived the rule it
 * depended on. "The validator did not object to it" meant something while the
 * validator read meaning. Since D-034 it means only "this line held no unknown
 * number and no unknown name", which is true of almost every line, including
 * every one the prompt's own read-back is meant to catch. So when the self
 * check added in D-036 correctly put "Supported recruitment" back in place of
 * "Led recruitment", the merge added in finding 8 read that as an accidental
 * drop, restored the promoted line, and the remaining lookup passed it again.
 * The self check and the merge were undoing each other, and the merge won.
 *
 * What separates the two cases is not what the line says, which nothing here
 * can read, but whether the retry spoke about the line at all. An answer that
 * names a bullet has made a decision about it, and writing the resume's own
 * text back is one of the decisions the prompt asks for. An answer that never
 * names the bullet has said nothing, and that is the omission finding 14 is
 * about. So: a named line stands, whatever its text; an unnamed line is put
 * back if the validator had not objected to it. The summary is always named,
 * because the schema requires the field, so it is never restored and the
 * prompt now says so (D-039).
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
  /** Of the dropped lines, those the retry named: it wrote the resume's own text back, which is a decision and stands. */
  reverted: string[];
  /** Of the dropped lines, those the retry never named: it said nothing, which is the omission finding 14 is about. */
  omitted: string[];
  /** Lines the previous answer edited, the summary counted as one. */
  of: number;
  /** Of the omitted lines, those the validator had no hard or review finding on, which are the ones put back. */
  clean: string[];
  /** True when the previous answer put the skills in an order other than the base's and the retry gave no order of its own. */
  droppedSkillOrder: boolean;
}

/**
 * What an answer spoke about: the lines it named and whether it gave a skill
 * order. This is the difference between a decision and a silence, and it
 * cannot be read off the change set alone, because the change set a document
 * mode answer produces holds only the lines whose text differs from the base
 * while the answer itself returned every line (D-039).
 */
export interface Explicit {
  lines: Set<string>;
  skillOrder: boolean;
}

/**
 * What a changes mode answer spoke about: the bullets it listed, and the
 * summary, which the schema makes it write whether it has one or not.
 */
export const explicitOf = (cs: ChangeSet): Explicit => ({ lines: new Set([...cs.changes.map((c) => c.bullet), "summary"]), skillOrder: cs.skills.length > 0 });

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
 * @param explicit what the retry spoke about; defaults to what a changes mode answer names
 */
export function classifyRetry(
  base: ResumeDocument,
  previous: ChangeSet,
  next: ChangeSet,
  previousFindings: PacketFinding[],
  explicit: Explicit = explicitOf(next),
): RetryClassification {
  const baseSkills = base.skills.map((s) => s.id);
  const first = effectOf(base, previous);
  const second = effectOf(base, next);
  const before = first.lines;
  const after = second.lines;
  const dropped = [...before].filter((b) => !after.has(b));
  const objected = objectedTo(previousFindings);
  // A line the retry named and left at the base text is a reversion it chose, and reverting an unsupported line is
  // one of the two things the prompt asks for. It is not the merge's to undo, however clean the lookup finds it.
  const reverted = dropped.filter((b) => explicit.lines.has(b));
  const omitted = dropped.filter((b) => !explicit.lines.has(b));
  const clean = omitted.filter((b) => !objected.has(b));
  // A reorder is dropped only when the retry gave no order at all. An order it wrote, even the base's, is its own.
  const droppedSkillOrder = !sameOrder(first.skills, baseSkills) && sameOrder(second.skills, baseSkills) && !explicit.skillOrder;
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
  return { kind, dropped, reverted, omitted, of: before.size, clean, droppedSkillOrder };
}

/** The sentence a classification prints, on the attempt log and in the soft finding. */
export function describeRetry(c: RetryClassification): string {
  const head =
    c.kind === "dropped edited lines" || c.kind === "edited a different set of lines"
      ? `the retry ${c.kind === "dropped edited lines" ? "dropped" : "edited a different set of lines and dropped"} ${c.dropped.length} of ${c.of} edited lines`
      : `the retry ${c.kind}`;
  const chose = c.reverted.length
    ? `; it left ${c.reverted.length} of them at the resume's own text, which is its decision and stands${c.reverted.includes("summary") ? ", the summary among them" : ""}`
    : "";
  const kept = c.clean.length
    ? `; ${c.clean.length} ${c.clean.length === 1 ? "line the retry never named and the validator had not objected to was" : "lines the retry never named and the validator had not objected to were"} put back from the answer before it`
    : "";
  const skills = c.droppedSkillOrder ? "; no skill order was given and the previous one was put back" : "";
  return head + chose + kept + skills;
}

/**
 * The retry's answer with the previous answer's omitted clean lines put back,
 * and the skill order when the retry gave none. Only lines the retry never
 * named and the validator did not object to are restored, and the result is
 * validated whole by the caller. The retry's own text always wins on a line it
 * named, including when that text is the resume's own.
 *
 * The summary is never restored. The schema makes every answer write the
 * field, so there is no silence to tell apart from a decision, and a retry
 * that returns a different summary or none has decided. The prompt says this
 * in as many words, so the model is not surprised by it (D-039).
 */
export function mergeRetry(previous: ChangeSet, next: ChangeSet, c: RetryClassification): ChangeSet {
  const restore = new Set(c.clean.filter((b) => b !== "summary"));
  if (!restore.size && !c.droppedSkillOrder) return next;
  return {
    ...next,
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
