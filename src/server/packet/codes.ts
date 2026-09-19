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

const KNOWN: ReadonlySet<string> = new Set(FINDING_CODES);

/** True when this build declares the code. The one place that decides it. */
export const isFindingCode = (code: string): code is FindingCode => KNOWN.has(code);

/**
 * A finding's code: the one it carries **if this build declares it**, or the
 * one its message names on a row written before codes existed.
 *
 * **The membership test is the point** (D-066). This used to be
 * `return f.code as FindingCode`, an unchecked cast, and the type that makes
 * it look safe is a claim about data rather than a fact about it: `findings`
 * is `jsonb` and the database enforces nothing. A row written by a later
 * build, a hand edit or a restored snapshot can carry a code this build has
 * never heard of, and the cast handed it on as valid. Downstream that became
 * `FINDING_LABELS[code]` evaluating to `undefined` and a count table with a
 * row called "undefined", which is the same defect D-061 removed from the
 * label map, re-entering through the data.
 *
 * An unrecognised code returns null and **does not fall through to the
 * message**. Reading the message of a finding that named itself something
 * else would relabel it as a rule it is not, which is the bucket-joining this
 * whole file exists to stop. `unknownCodeOf` is how it stays visible.
 */
export function codeOf(f: { code?: string; message: string }): FindingCode | null {
  if (f.code) return isFindingCode(f.code) ? f.code : null;
  for (const [prefix, code] of LEGACY) if (f.message.startsWith(prefix)) return code;
  return null;
}

/** The code a finding carries that this build does not declare, or null. Kept separate so an unknown code is reportable by name rather than merely absent. */
export const unknownCodeOf = (f: { code?: string; message: string }): string | null => (f.code && !isFindingCode(f.code) ? f.code : null);

/**
 * What a stored finding could not be recognised as, over findings read from
 * the database or from a snapshot file.
 *
 * Neither number is an error and neither throws. A report that stops because
 * one row is odd tells you less than one that prints the row, and these are
 * the instrument the restamp is judged with.
 */
export interface FindingsRead {
  /** Codes this build does not declare, by name, with how many findings carry each. */
  unknownCodes: Map<string, number>;
  /** Findings carrying no code whose message no legacy prefix names either. */
  unrecognised: number;
  /** Findings read in all. */
  total: number;
}

/**
 * The boundary check: findings as they come off `jsonb` or a JSON file, read
 * for what this build can and cannot recognise.
 *
 * The type on `packets.findings` says `PacketFinding[]`, and that is an
 * assertion about the column rather than a guarantee from it. This is where
 * the assertion is tested, and what it finds is printed by name.
 */
export function readFindings(findings: { code?: string; message: string }[]): FindingsRead {
  const unknownCodes = new Map<string, number>();
  let unrecognised = 0;
  for (const f of findings) {
    const unknown = unknownCodeOf(f);
    if (unknown) unknownCodes.set(unknown, (unknownCodes.get(unknown) ?? 0) + 1);
    else if (!codeOf(f)) unrecognised += 1;
  }
  return { unknownCodes, unrecognised, total: findings.length };
}

/**
 * One line saying what the read found, **always**.
 *
 * It used to return null on a clean read, so the boundary printed nothing when
 * everything was recognised. That is the defect this file's own scans carry a
 * floor against: a check that found nothing reports no violations and is
 * indistinguishable from a check that did not run, in the one report a restamp
 * is judged from. The clean line says how many findings were read and that
 * every code is declared, so the reader can tell the two apart.
 */
export function describeFindingsRead(r: FindingsRead): string {
  const parts: string[] = [];
  for (const [code, n] of [...r.unknownCodes].sort((a, b) => b[1] - a[1])) parts.push(`${n} carrying the code "${code}", which this build does not declare`);
  if (r.unrecognised) parts.push(`${r.unrecognised} carrying no code and no message this build names`);
  if (!parts.length) return `${r.total} stored findings read, and every code on them is one this build declares`;
  return `${r.total} stored findings read: ${parts.join("; ")}. Counted and printed by name, never as "undefined" and never folded into another reason`;
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
 * A finding this build cannot name still prints, by name where it has one.
 * There are two such cases and they are not the same (D-066):
 *
 * - it carries a code this build does not declare. Printed as
 *   `unknown code: <the code>`, so the name reaches the reader;
 * - it carries no code and no message any legacy prefix names. Printed as
 *   `no code: <the message>`.
 *
 * **What is enforced and where, stated rather than implied.** A finding
 * created in this repository must carry a code, and `codes.test.ts` fails the
 * build if one does not. A finding read back from `jsonb` or from a snapshot
 * may carry anything, because the column is not the type, so the code is
 * checked for membership when it is read. Neither of those says a stored
 * codeless finding is old; it usually is, and nothing establishes it.
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

/** The label for a finding; an unknown code is named, and a codeless finding is named by its message. Never `undefined`. */
export const labelOf = (f: { code?: string; message: string }): string => {
  const unknown = unknownCodeOf(f);
  if (unknown) return `unknown code: ${unknown}`;
  const code = codeOf(f);
  return code ? FINDING_LABELS[code] : `no code: ${f.message}`;
};
