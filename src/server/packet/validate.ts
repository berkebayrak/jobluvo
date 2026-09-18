import type { PacketFinding, ResumeDocument } from "@/db/schema";
import { claimsOf, fmt, sameValue, type Claim, type FactClaim } from "./claims";
import { entityFindings, lemmasOf, type PostingScope } from "./entities";
import { readNumbers } from "./normalise";
import type { ChangeSet, FactEntry } from "./resume";

export { normaliseNumbers } from "./normalise";

/**
 * The revision of the rules as they stand. Stamped on every packet the run
 * or a replay writes, so a status says which rules it passed. Bumped with
 * every change to claims.ts, entities.ts, normalise.ts or this file;
 * `npm run validator-report` restamps the stored packets under the new
 * one (D-017).
 */
export const VALIDATOR_REVISION = "2026-09-18.r7";

/*
 * The guarantee behind "nothing is added that is not on your profile", and
 * only that.
 *
 * One question is asked of a proposed line: does every value and every name
 * in it appear somewhere in the user's confirmed facts. A value or a name
 * that appears nowhere is a hard finding and rejects the packet; the model
 * can fix an invention from the finding, so a hard finding earns one retry,
 * then the packet is invalid.
 *
 * The lookup is profile wide, not against the facts the line cites. That is
 * the user's decision (D-034) and it is the whole of what the code now
 * checks. The validator used to read what a line means and compare it with
 * what the cited fact means: whether a number stayed attached to the same
 * subject, whether the level of responsibility rose, whether a denial was
 * reversed, whether the employer was right. All of that is removed. It is
 * stated in the tailoring prompt instead, in the four prohibitions that
 * carry the principle at the top of design/docs/06-Decision-Log.md, and the
 * prompt is now the main line of defence.
 *
 * What that costs is measured and written down rather than implied: 19 of 28
 * known false lines stop being caught, 10 of them plain inventions, because a
 * word that appears anywhere on the profile satisfies this check. Nothing
 * here is evidence that a particular resume is clean.
 *
 * Three things are kept that are not meaning comparisons. A number phrase the
 * normaliser could not read is held, because the lookup did not run on it and
 * passing it would say it had. A citation that names nothing, or names a fact
 * that does not exist, is held: it says the answer is confused, not that it
 * means the wrong thing. And the change set's own integrity, an edit to a
 * line the resume does not have, is soft as it always was.
 */

/**
 * The values a text asserts, as canonical keys: "pct:11", "money:usd:9200000",
 * "date:2023-01", "year:2023", "num:4". With `broad`, the looser forms are
 * emitted as well (a percentage also as its number, a month date also as its
 * year). Kept for the reports; the validator matches on claims.
 */
export function valuesOf(text: string, broad = false): Set<string> {
  const out = new Set<string>();
  for (const c of claimsOf(text)) {
    out.add(c.key);
    if (!broad) continue;
    if (c.kind === "pct" || c.kind === "money") out.add(`num:${fmt(c.value as number)}`);
    if (c.kind === "date") out.add(`year:${String(c.value).slice(0, 4)}`);
  }
  return out;
}

export interface FactSet {
  entries: FactEntry[];
  entryById: Map<string, FactEntry>;
  /** Per fact id, its claims. */
  byId: Map<string, FactClaim[]>;
  /** Every claim of every fact. */
  all: FactClaim[];
  /** All fact text, lower case. */
  corpus: string;
  /** Every content lemma on the profile: what "on the profile" means for the non numeric check. */
  lemmas: Set<string>;
  /** Per fact id, the number phrases the normaliser could not read; a value checked against such a fact is held, not rejected. */
  unreadable: Map<string, string[]>;
}

export function factSet(entries: FactEntry[]): FactSet {
  const byId = new Map<string, FactClaim[]>();
  const all: FactClaim[] = [];
  const unreadable = new Map<string, string[]>();
  for (const e of entries) {
    const claims = claimsOf(e.text).map((c) => ({ ...c, factId: e.id, role_of_fact: e.role, source: e.source }));
    byId.set(e.id, claims);
    all.push(...claims);
    const phrases = readNumbers(e.text).unreadable;
    if (phrases.length) unreadable.set(e.id, phrases);
  }
  const corpus = entries.map((e) => e.text).join("\n");
  return { entries, entryById: new Map(entries.map((e) => [e.id, e])), byId, all, corpus: corpus.toLowerCase(), lemmas: lemmasOf(corpus), unreadable };
}

/** The role a line belongs to: R2 for the bullet R2.3 and for the heading R2; null for the summary and anything else. */
export function roleOfLine(bullet: string | null): string | null {
  if (!bullet) return null;
  const m = /^(R\d+)(?:\.\d+)?$/.exec(bullet);
  return m ? m[1] : null;
}

/** Checks one proposed line: every value and every name in it must appear somewhere in the confirmed facts. `posting` is the job's lemmas. */
export function checkLine(line: string, bullet: string | null, cited: string[], facts: FactSet, posting: Set<string> = new Set(), scope: PostingScope = "claim"): PacketFinding[] {
  const out: PacketFinding[] = [];
  // Citations are no longer what a value is checked against, so these two say
  // the answer is confused rather than that it is wrong. Held, not rejected.
  for (const id of cited) if (!facts.byId.has(id)) out.push({ level: "review", bullet, code: "cited-fact-missing", message: "cited fact does not exist", value: id });
  if (!cited.length) out.push({ level: "review", bullet, code: "no-fact-cited", message: "no fact cited for this line" });

  // The one check: a value in no confirmed fact at all.
  for (const p of claimsOf(line)) {
    if (!facts.all.some((c) => sameValue(c, p))) out.push({ level: "hard", bullet, code: "value-unknown", message: "value appears in no confirmed fact", value: p.key });
  }

  // A number phrase the normaliser could not read is a value the lookup never ran on. Held, never passed.
  for (const phrase of readNumbers(line).unreadable) out.push({ level: "review", bullet, code: "number-unreadable", message: "a number phrase could not be read", value: phrase });

  // The same question for names, qualifications and words taken from the posting (entities.ts).
  out.push(...entityFindings(line, bullet, facts.lemmas, posting, scope));
  return out;
}

/**
 * Review findings the model can act on. A hard finding always earns its
 * retry; this list is the held ones a second call could still fix. Both that
 * remain are about the citation, which the model can simply supply. Not on
 * the list: a number phrase the normaliser could not read, which a second
 * call cannot resolve.
 */
export const ACTIONABLE = new Set([
  "no fact cited for this line",
  "cited fact does not exist",
]);
export const actionable = (f: PacketFinding) => f.level === "review" && ACTIONABLE.has(f.message);

export function validateChangeSet(cs: ChangeSet, base: ResumeDocument, facts: FactSet, posting: Set<string> = new Set(), scope: PostingScope = "claim"): PacketFinding[] {
  const out: PacketFinding[] = [];
  const bullets = new Set(base.experience.flatMap((r) => r.bullets.map((b) => b.id)));
  const seen = new Set<string>();
  for (const c of cs.changes) {
    if (!bullets.has(c.bullet)) {
      out.push({ level: "soft", bullet: c.bullet, code: "line-missing", message: "no such line on the resume; edit dropped" });
      continue;
    }
    if (seen.has(c.bullet)) out.push({ level: "soft", bullet: c.bullet, code: "line-edited-twice", message: "line edited twice; the last edit stands" });
    seen.add(c.bullet);
    if (!c.text.trim()) out.push({ level: "hard", bullet: c.bullet, code: "empty-line", message: "empty line" });
    out.push(...checkLine(c.text, c.bullet, c.facts, facts, posting, scope));
  }
  if (cs.summary) out.push(...checkLine(cs.summary, "summary", cs.summaryFacts, facts, posting, scope));
  const skillIds = new Set(base.skills.map((s) => s.id));
  for (const id of cs.skills) if (!skillIds.has(id)) out.push({ level: "soft", bullet: null, code: "skill-missing", message: "no such skill; ignored", value: id });
  return out;
}

export const isHard = (f: PacketFinding[]) => f.some((x) => x.level === "hard");
export const needsReview = (f: PacketFinding[]) => !isHard(f) && f.some((x) => x.level === "review");

export type { Claim, FactClaim };
