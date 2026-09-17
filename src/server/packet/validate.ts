import type { PacketFinding, ResumeDocument } from "@/db/schema";
import { claimsOf, contradiction, metricsAgree, sameValue, type Claim, type FactClaim } from "./claims";
import { fmt } from "./normalise";
import type { ChangeSet, FactEntry } from "./resume";

export { normaliseNumbers } from "./normalise";

/*
 * The guarantee behind "nothing is added that is not on your profile".
 *
 * Every value in a proposed line is read as a claim (claims.ts): the
 * number, what kind of value it is, its unit, the words it measures,
 * whether it is a result or a target, which way it moved. It must be
 * supported by a claim of a fact the line cites, and support means the
 * same value with the same kind, unit and role and no contradicting
 * direction. A value in none of the cited facts, or one whose meaning
 * changed on the way, is a hard finding and rejects the packet: the model
 * can fix a contradiction from the finding, so a hard finding earns one
 * retry, then the packet is invalid.
 *
 * Two things the validator cannot decide are held for a person, level
 * review, with no retry: a value whose metric words differ or cannot be
 * read (shared words are a poor synonym test, and churn rewritten as
 * customer attrition is true), and a name, a tool, an employer, a
 * qualification, that appears in no fact. A retry cannot resolve an
 * unknown; it can only make the model drop the line to be safe, an
 * omission with nobody deciding it.
 *
 * A line under one employer may cite employment facts of that employer
 * only. The number is real, the win is real, and the employer is wrong is
 * the most valuable lie a resume can tell, and no value check sees it.
 * Hard: there is no ambiguity in a role id. The summary draws on every
 * role and is not restricted.
 *
 * Everything else is soft and travels with the packet: a cited fact that
 * does not exist, an edit to a line the resume does not have, and a value
 * supported by a line the user typed rather than the resume's words, which
 * the review screen can then say.
 */

/**
 * Sentence initial names are checked like any other name. Whether a miss
 * holds the packet (review) or only travels with it (soft) is decided from
 * the measurement over the stored edits, where a capitalised verb the
 * resume never used is the false positive to count.
 */
export const SENTENCE_INITIAL_NAMES: "review" | "soft" = "soft";

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

const STOP = new Set(["i", "a", "the", "and", "or", "of", "to", "in", "for", "with", "at", "on", "by", "from", "as", "an"]);

function nameRuns(text: string, initial: boolean): string[] {
  const names: string[] = [];
  const sentences = text.split(/(?<=[.!?])\s+/);
  for (const s of sentences) {
    const words = s.split(/\s+/);
    let run: string[] = [];
    let runStartsSentence = false;
    const flush = () => {
      if (run.length && runStartsSentence === initial) names.push(run.join(" "));
      run = [];
      runStartsSentence = false;
    };
    words.forEach((raw, i) => {
      const w = raw.replace(/^[("']+|[)",.;:'!?]+$/g, "");
      const cap = /^[A-Z][A-Za-z&.-]*$/.test(w) && !STOP.has(w.toLowerCase());
      const acronym = /^[A-Z][A-Z&]{1,6}$/.test(w);
      if (cap || acronym) {
        if (!run.length) runStartsSentence = i === 0 && !acronym;
        run.push(w);
      } else flush();
      // A comma, semicolon or slash after the word ends the name: "SQL, Power BI" is two names, not one.
      if (/[,;/]$/.test(raw)) flush();
    });
    flush();
  }
  return names;
}

/** Capitalised words and all caps tokens, as the names a line drops. Sentence initial words are in `initialNamesOf`. */
export const namesOf = (text: string): string[] => nameRuns(text, false);

/** The capitalised run that opens a sentence: "Salesforce implementation specialist" gives "Salesforce", "Led the team" gives "Led". */
export const initialNamesOf = (text: string): string[] => nameRuns(text, true);

export interface FactSet {
  entries: FactEntry[];
  entryById: Map<string, FactEntry>;
  /** Per fact id, its claims. */
  byId: Map<string, FactClaim[]>;
  /** Every claim of every fact. */
  all: FactClaim[];
  /** All fact text, lower case, for the name check. */
  corpus: string;
}

export function factSet(entries: FactEntry[]): FactSet {
  const byId = new Map<string, FactClaim[]>();
  const all: FactClaim[] = [];
  for (const e of entries) {
    const claims = claimsOf(e.text).map((c) => ({ ...c, factId: e.id, role_of_fact: e.role, source: e.source }));
    byId.set(e.id, claims);
    all.push(...claims);
  }
  return { entries, entryById: new Map(entries.map((e) => [e.id, e])), byId, all, corpus: entries.map((e) => e.text).join("\n").toLowerCase() };
}

/** The role a line belongs to: R2 for the bullet R2.3 and for the heading R2; null for the summary and anything else. */
export function roleOfLine(bullet: string | null): string | null {
  if (!bullet) return null;
  const m = /^(R\d+)(?:\.\d+)?$/.exec(bullet);
  return m ? m[1] : null;
}

/** Checks one proposed line against the facts it cites. */
export function checkLine(line: string, bullet: string | null, cited: string[], facts: FactSet): PacketFinding[] {
  const out: PacketFinding[] = [];
  for (const id of cited) if (!facts.byId.has(id)) out.push({ level: "soft", bullet, message: "cited fact does not exist", value: id });

  // A line under one employer may cite that employer's employment facts only.
  const role = roleOfLine(bullet);
  if (role) {
    for (const id of cited) {
      const e = facts.entryById.get(id);
      if (e && e.kind === "employment" && e.role !== role) {
        out.push({ level: "hard", bullet, message: "cites a fact from another role", value: id, detail: `${id} belongs to ${e.role}; this line is under ${role}` });
      }
    }
  }

  const citedClaims = cited.flatMap((id) => facts.byId.get(id) ?? []);
  for (const p of claimsOf(line)) {
    const same = citedClaims.filter((c) => sameValue(c, p));
    if (!same.length) {
      // A value must appear in a fact the line cites, not merely somewhere on the
      // profile. "Six" once passed because six was on another line; that is the
      // gap this closes. Measured before it shipped over the 520 edits of the
      // first sample: 5 rejected, all the same invention, 0 legitimate edits.
      if (!facts.all.some((c) => sameValue(c, p))) out.push({ level: "hard", bullet, message: "value appears in no confirmed fact", value: p.key });
      else if (!cited.length) out.push({ level: "hard", bullet, message: "value with no fact cited for it", value: p.key });
      else out.push({ level: "hard", bullet, message: "value is on the profile but not in the cited facts", value: p.key });
      continue;
    }
    const supports = same.filter((c) => contradiction(c, p) === null);
    if (!supports.length) {
      const why = contradiction(same[0], p)!;
      out.push({ level: "hard", bullet, message: `value does not mean what the fact means: ${why}`, value: p.key, detail: `fact: ${same[0].clause} / line: ${p.clause}` });
      continue;
    }
    const agreement = supports.map((c) => metricsAgree(c, p));
    const at = (k: "yes" | "unreadable" | "differ") => supports[agreement.indexOf(k)];
    if (agreement.includes("yes")) {
      const c = at("yes");
      if (c.source.origin === "edit") out.push({ level: "soft", bullet, message: "value is from a line you typed, not the resume's words", value: p.key, origin: "edit", detail: c.clause });
      continue;
    }
    const c = agreement.includes("unreadable") ? at("unreadable") : at("differ");
    out.push({
      level: "review",
      bullet,
      message: agreement.includes("unreadable") ? "value matched on kind, unit and role only; the metric could not be read" : "the fact and the line measure different things",
      value: p.key,
      detail: `fact: ${c.clause} / line: ${p.clause}`,
      ...(c.source.origin === "edit" ? { origin: "edit" as const } : {}),
    });
  }

  for (const n of namesOf(line)) {
    if (!nameOnProfile(n, facts.corpus)) out.push({ level: "review", bullet, message: "name appears in no confirmed fact", value: n });
  }
  for (const n of initialNamesOf(line)) {
    if (nameOnProfile(n, facts.corpus)) continue;
    // "Power BI reporting" opens with a name that is on the profile whole. "Built PMO" does not: the opening word may be a verb,
    // so it is looked up on its own and the rest as an ordinary name, and only the parts on no fact are reported.
    const [first, ...rest] = n.split(" ");
    if (!nameOnProfile(first, facts.corpus)) out.push({ level: SENTENCE_INITIAL_NAMES, bullet, message: "name appears in no confirmed fact", value: first, detail: "sentence initial" });
    if (rest.length && !nameOnProfile(rest.join(" "), facts.corpus)) out.push({ level: "review", bullet, message: "name appears in no confirmed fact", value: rest.join(" ") });
  }
  return out;
}

/**
 * A name is on the profile when it appears in the facts as written, or as
 * the singular of a plural ("PMOs" for "PMO"). A run of several capitalised
 * words is one name and is looked up whole: two known words side by side
 * are not a known name, so "Power SQL" is flagged even though both words
 * are on the profile. The first sample's three runs of known names were
 * the tokeniser joining across commas, fixed in `namesOf`, not a case for
 * looking words up one at a time.
 */
export function nameOnProfile(name: string, corpus: string): boolean {
  const lc = name.toLowerCase();
  return corpus.includes(lc) || (lc.endsWith("s") && corpus.includes(lc.slice(0, -1)));
}

export function validateChangeSet(cs: ChangeSet, base: ResumeDocument, facts: FactSet): PacketFinding[] {
  const out: PacketFinding[] = [];
  const bullets = new Set(base.experience.flatMap((r) => r.bullets.map((b) => b.id)));
  const seen = new Set<string>();
  for (const c of cs.changes) {
    if (!bullets.has(c.bullet)) {
      out.push({ level: "soft", bullet: c.bullet, message: "no such line on the resume; edit dropped" });
      continue;
    }
    if (seen.has(c.bullet)) out.push({ level: "soft", bullet: c.bullet, message: "line edited twice; the last edit stands" });
    seen.add(c.bullet);
    if (!c.text.trim()) out.push({ level: "hard", bullet: c.bullet, message: "empty line" });
    out.push(...checkLine(c.text, c.bullet, c.facts, facts));
  }
  if (cs.summary) out.push(...checkLine(cs.summary, "summary", cs.summaryFacts, facts));
  const skillIds = new Set(base.skills.map((s) => s.id));
  for (const id of cs.skills) if (!skillIds.has(id)) out.push({ level: "soft", bullet: null, message: "no such skill; ignored", value: id });
  return out;
}

export const isHard = (f: PacketFinding[]) => f.some((x) => x.level === "hard");
export const needsReview = (f: PacketFinding[]) => !isHard(f) && f.some((x) => x.level === "review");

export type { Claim, FactClaim };
