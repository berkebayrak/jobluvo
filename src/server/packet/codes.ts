/*
 * The stable name of every finding the validator can write (review four,
 * finding 17).
 *
 * Before this, a report that wanted to count one kind of finding matched on
 * the message text. That coupling has failed twice in one day, silently both
 * times: the validator report's review table ended in a fallback branch, so
 * three entity rules added in one pull request were counted as "metric
 * unreadable"; and the wrong citation metric matches one prose string in SQL,
 * so the day that sentence is reworded the metric reads zero and looks like
 * an improvement. A counter that reads zero because its filter found nothing
 * is the failure mode this project keeps hunting.
 *
 * A code is written once and never reworded. The message is free to change,
 * because nothing counts it.
 */

export const FINDING_CODES = [
  // Citations: what the line points at.
  "no-fact-cited",
  "cited-fact-missing",
  "wrong-role",
  // Values: what the line claims a number is.
  "value-unknown",
  "value-uncited",
  "value-not-in-cited",
  "value-contradicts",
  "value-uncheckable",
  "value-from-edit",
  "metric-differs",
  "metric-unreadable",
  "number-unreadable",
  // Entities: what the line names.
  "name-unknown",
  "posting-word-unknown",
  "qualification-unsupported",
  "responsibility-not-in-cited",
  "tool-not-in-cited",
  "entity-not-in-cited",
  // The change set itself.
  "line-missing",
  "line-edited-twice",
  "empty-line",
  "skill-missing",
  // Written by the replay and the run rather than the validator.
  "summary-not-revalidated",
  "resume-repaired",
  "assessment-not-run",
  "profile-not-reproducible",
  "posting-moved",
  "unverifiable-resume",
  "retry-provenance",
] as const;

export type FindingCode = (typeof FINDING_CODES)[number];

/**
 * The four ways a line can fail to be supported by what it cites, which is
 * what the wrong citation metric is asking about. Splitting them matters
 * because they are different defects with different fixes: a number the
 * cited facts do not carry is the model citing the wrong fact, a
 * responsibility they do not carry is the model inventing work, no citation
 * at all is the model not answering the question, and a fact from another
 * role is the model attributing work to the wrong employer.
 *
 * A code not in this map is not a citation failure and is counted in
 * neither the numerator nor the denominator.
 */
export const CITATION_KIND: Partial<Record<FindingCode, "numeric support" | "unsupported responsibility" | "missing citation" | "wrong role">> = {
  "value-not-in-cited": "numeric support",
  "value-contradicts": "numeric support",
  "metric-differs": "numeric support",
  "value-unknown": "numeric support",
  "responsibility-not-in-cited": "unsupported responsibility",
  "tool-not-in-cited": "unsupported responsibility",
  "entity-not-in-cited": "unsupported responsibility",
  "qualification-unsupported": "unsupported responsibility",
  "no-fact-cited": "missing citation",
  "cited-fact-missing": "missing citation",
  "value-uncited": "missing citation",
  "wrong-role": "wrong role",
};

export const CITATION_KINDS = ["numeric support", "unsupported responsibility", "missing citation", "wrong role"] as const;
export type CitationKind = (typeof CITATION_KINDS)[number];

/**
 * The code a finding stored before codes existed would have carried, read
 * from its message. Only for rows written before this shipped: nothing new
 * goes through here, and a message this does not recognise reads as null so
 * a legacy row is counted as unknown rather than as the wrong kind.
 */
const LEGACY: [string, FindingCode][] = [
  ["cited fact does not exist", "cited-fact-missing"],
  ["no fact cited", "no-fact-cited"],
  ["cites a fact from another role", "wrong-role"],
  ["value appears in no confirmed fact", "value-unknown"],
  ["value with no fact cited for it", "value-uncited"],
  ["value is on the profile but not in the cited facts", "value-not-in-cited"],
  ["value does not mean what the fact means", "value-contradicts"],
  ["value could not be checked", "value-uncheckable"],
  ["value is from a line you typed", "value-from-edit"],
  ["the fact and the line measure different things", "metric-differs"],
  ["value matched on kind, unit and role only", "metric-unreadable"],
  ["a number phrase could not be read", "number-unreadable"],
  ["name appears in no confirmed fact", "name-unknown"],
  ["word from the posting appears in no confirmed fact", "posting-word-unknown"],
  ["qualification appears in no confirmed fact", "qualification-unsupported"],
  ["responsibility is not in the cited facts", "responsibility-not-in-cited"],
  ["tool is not in the cited facts", "tool-not-in-cited"],
  ["entity is on the profile but not in the cited facts", "entity-not-in-cited"],
  ["no such line on the resume", "line-missing"],
  ["line edited twice", "line-edited-twice"],
  ["empty line", "empty-line"],
  ["no such skill", "skill-missing"],
  ["summary not revalidated", "summary-not-revalidated"],
  ["profile not reproducible", "profile-not-reproducible"],
  ["posting moved", "posting-moved"],
  ["stored resume is not the base plus the stored changes", "unverifiable-resume"],
  ["this answer is a retry", "retry-provenance"],
];

/** A finding's code: the one it carries, or the one its message names on a row written before codes existed. */
export function codeOf(f: { code?: string; message: string }): FindingCode | null {
  if (f.code) return f.code as FindingCode;
  for (const [prefix, code] of LEGACY) if (f.message.startsWith(prefix)) return code;
  return null;
}

/**
 * The short name a report prints for each code, one per code and no two the
 * same.
 *
 * **`Record` and not `Partial<Record>`, which is the whole point of it being
 * here** (D-061). The label map used to live inside `scripts/validator-report.ts`
 * as a partial map with a fallback branch, so a code with no entry printed
 * "unclassified" and the table stayed the right shape and the right length.
 * Four codes had drifted into that state, one of them `posting-moved`, which is
 * a live reason a row is held, so **the report read to decide whether a restamp
 * is safe could not name one of the reasons in front of the reader.**
 *
 * Typed exhaustively, a code added to `FINDING_CODES` without a label is a
 * typecheck failure, so it is caught by `npm run check` before it can print
 * anything. `codes.test.ts` asserts the same at run time and asserts the labels
 * are distinct, because two codes sharing a label is the other way a table
 * quietly merges two reasons into one bucket.
 *
 * A finding with no code at all is a different thing and still prints: it is a
 * row written before codes existed whose message no legacy prefix matches, and
 * it is named as codeless rather than as one of these.
 */
export const FINDING_LABELS: Record<FindingCode, string> = {
  // Citations: what the line points at.
  "no-fact-cited": "no fact cited",
  "cited-fact-missing": "cited fact does not exist",
  "wrong-role": "fact cited from another role",
  // Values: what the line claims a number is.
  "value-unknown": "value in no confirmed fact",
  "value-uncited": "value with no fact cited for it",
  "value-not-in-cited": "value not in the cited facts",
  "value-contradicts": "value contradicts the fact",
  "value-uncheckable": "number phrase unreadable, cited fact",
  "value-from-edit": "value from a line the user typed",
  "metric-differs": "metric words differ",
  "metric-unreadable": "metric unreadable",
  "number-unreadable": "number phrase unreadable, line",
  // Entities: what the line names.
  "name-unknown": "name",
  "posting-word-unknown": "posting word",
  "qualification-unsupported": "qualification",
  "responsibility-not-in-cited": "responsibility",
  "tool-not-in-cited": "tool",
  "entity-not-in-cited": "entity not in the cited facts",
  // The change set itself.
  "line-missing": "edit to a line the resume does not have",
  "line-edited-twice": "line edited twice",
  "empty-line": "empty line",
  "skill-missing": "skill the resume does not have",
  // Written by the replay and the run rather than the validator.
  "summary-not-revalidated": "summary not revalidated",
  "resume-repaired": "resume restored from outside the row",
  "assessment-not-run": "original assessment failed, held for a person",
  "profile-not-reproducible": "profile not reproducible",
  "posting-moved": "posting moved since the packet was written",
  "unverifiable-resume": "stored resume is not the base plus the stored changes",
  "retry-provenance": "this answer is a retry",
};

/** The label for a finding, or a name saying it carries no code this build knows. */
export const labelOf = (f: { code?: string; message: string }): string => {
  const code = codeOf(f);
  return code ? FINDING_LABELS[code] : `no code: ${f.message}`;
};
