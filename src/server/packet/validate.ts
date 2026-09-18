import type { PacketFinding, ResumeDocument } from "@/db/schema";
import { claimsOf, contradiction, metricsAgree, sameValue, type Claim, type FactClaim } from "./claims";
import { entityFindings, lemmasOf, type PostingScope } from "./entities";
import { fmt, readNumbers } from "./normalise";
import type { ChangeSet, FactEntry } from "./resume";

export { normaliseNumbers } from "./normalise";

/**
 * The revision of the rules as they stand. Stamped on every packet the run
 * or a replay writes, so a status says which rules it passed. Bumped with
 * every change to claims.ts, entities.ts, normalise.ts or this file;
 * `npm run validator-report` restamps the stored packets under the new
 * one (D-017).
 */
export const VALIDATOR_REVISION = "2026-09-18.r4";

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

/** Checks one proposed line against the facts it cites. `posting` is the job's lemmas, for the word the model took from the posting. */
export function checkLine(line: string, bullet: string | null, cited: string[], facts: FactSet, posting: Set<string> = new Set(), scope: PostingScope = "claim"): PacketFinding[] {
  const out: PacketFinding[] = [];
  // A citation that names nothing supports nothing: the line's values are checked against the facts that do exist, and a person reads the rest.
  for (const id of cited) if (!facts.byId.has(id)) out.push({ level: "review", bullet, message: "cited fact does not exist", value: id });
  // A line that cites nothing asserts on its own authority, whatever it says.
  if (!cited.length) out.push({ level: "review", bullet, message: "no fact cited for this line" });

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
  // A cited fact with a number phrase the normaliser could not read may hold the value the line uses; the line is held, not rejected, until a person reads it.
  const citedUnreadable = cited.flatMap((id) => facts.unreadable.get(id) ?? []);
  for (const p of claimsOf(line)) {
    const same = citedClaims.filter((c) => sameValue(c, p));
    if (!same.length && citedUnreadable.length) {
      out.push({ level: "review", bullet, message: "value could not be checked; a cited fact has a number phrase that could not be read", value: p.key, detail: citedUnreadable.join("; ") });
      continue;
    }
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

  // A number phrase the normaliser could not read is a value the validator never saw. Held, never passed.
  for (const phrase of readNumbers(line).unreadable) out.push({ level: "review", bullet, message: "a number phrase could not be read", value: phrase });

  // The non numeric check (entities.ts): a new entity, qualification or responsibility is held; a rewording is not.
  const citedFacts = cited.flatMap((id) => (facts.entryById.has(id) ? [{ id, text: facts.entryById.get(id)!.text }] : []));
  out.push(...entityFindings(line, bullet, citedFacts, facts.lemmas, posting, scope));
  return out;
}

/**
 * Review findings the model can act on: each names the word or value that
 * failed and what the fact has in its place, so a retry that carries it
 * can substitute the fact's own word (D-017 note, D-022). Not on the list:
 * findings that express uncertainty, a phrase the validator could not
 * read, which a second call cannot resolve.
 */
export const ACTIONABLE = new Set([
  "the fact and the line measure different things",
  "name appears in no confirmed fact",
  "word from the posting appears in no confirmed fact",
  "responsibility is not in the cited facts",
  "tool is not in the cited facts",
  "entity is on the profile but not in the cited facts",
  "qualification appears in no confirmed fact",
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
      out.push({ level: "soft", bullet: c.bullet, message: "no such line on the resume; edit dropped" });
      continue;
    }
    if (seen.has(c.bullet)) out.push({ level: "soft", bullet: c.bullet, message: "line edited twice; the last edit stands" });
    seen.add(c.bullet);
    if (!c.text.trim()) out.push({ level: "hard", bullet: c.bullet, message: "empty line" });
    out.push(...checkLine(c.text, c.bullet, c.facts, facts, posting, scope));
  }
  if (cs.summary) out.push(...checkLine(cs.summary, "summary", cs.summaryFacts, facts, posting, scope));
  const skillIds = new Set(base.skills.map((s) => s.id));
  for (const id of cs.skills) if (!skillIds.has(id)) out.push({ level: "soft", bullet: null, message: "no such skill; ignored", value: id });
  return out;
}

export const isHard = (f: PacketFinding[]) => f.some((x) => x.level === "hard");
export const needsReview = (f: PacketFinding[]) => !isHard(f) && f.some((x) => x.level === "review");

export type { Claim, FactClaim };
