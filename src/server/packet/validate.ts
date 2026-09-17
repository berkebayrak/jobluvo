import type { PacketFinding, ResumeDocument } from "@/db/schema";
import type { ChangeSet } from "./resume";
import type { FactEntry } from "./resume";

/*
 * The guarantee behind "nothing is added that is not on your profile".
 *
 * Every value in a proposed line, a number, an amount, a percentage, a
 * date, is normalised and looked up in the set of values of every
 * confirmed fact. A value that appears in no fact is a hard finding and
 * rejects the packet. Everything else is soft and travels with the
 * packet: a citation that does not carry the value it is cited for, a
 * cited fact that does not exist, a capitalised name that appears in no
 * fact, an edit to a line the resume does not have.
 *
 * Both sides go through the same normaliser, so eight and 8, USD 2.3M
 * and 2.3 million, Jan 2023 and January 2023 compare equal. When the
 * validator fires on a legitimate rephrasing the normaliser is what gets
 * fixed. The rule is never loosened.
 */

const UNITS: Record<string, number> = {
  zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
  eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19,
};
const TENS: Record<string, number> = { twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60, seventy: 70, eighty: 80, ninety: 90 };
const SCALES: Record<string, number> = { hundred: 100, thousand: 1_000, k: 1_000, million: 1_000_000, mn: 1_000_000, m: 1_000_000, billion: 1_000_000_000, bn: 1_000_000_000, b: 1_000_000_000 };
const MONTHS: Record<string, string> = {
  jan: "01", january: "01", feb: "02", february: "02", mar: "03", march: "03", apr: "04", april: "04", may: "05",
  jun: "06", june: "06", jul: "07", july: "07", aug: "08", august: "08", sep: "09", sept: "09", september: "09",
  oct: "10", october: "10", nov: "11", november: "11", dec: "12", december: "12",
};
const CURRENCIES: Record<string, string> = { usd: "usd", $: "usd", us$: "usd", eur: "eur", "€": "eur", gbp: "gbp", "£": "gbp", cad: "cad", try: "try" };

const fmt = (n: number) => (Number.isInteger(n) ? String(n) : String(Number(n.toFixed(6))));

/**
 * Text with every number written in digits: word numbers composed
 * ("twenty five" 25, "two million" 2000000), suffixes expanded ("9.2M"
 * 9200000, "400k" 400000), thousands separators dropped, hyphens between a
 * number and a word opened ("3-year" "3 year"). Lower case.
 */
export function normaliseNumbers(text: string): string {
  let t = text.toLowerCase().replace(/[–—]/g, " ").replace(/(\d),(\d{3})(?!\d)/g, "$1$2").replace(/(\d),(\d{3})(?!\d)/g, "$1$2");
  // A hyphen carries no value: "3-year", "three-year", "two-thirds" all open up. The one in a YYYY-MM date stays.
  t = t.replace(/-(?!(?:0[1-9]|1[0-2])(?![\d.]))/g, " ");
  t = t.replace(/(\d+(?:\.\d+)?)\s?(k|m|mn|b|bn|million|billion|thousand)\b/g, (_, n: string, s: string) => fmt(Number(n) * SCALES[s]));
  t = t.replace(/(\d+)(st|nd|rd|th)\b/g, "$1");
  const words = t.split(/(\s+|[^a-z0-9.%$€£])/);
  const out: string[] = [];
  let num: number | null = null;
  let pendingSpace = false;
  const flush = () => {
    if (num !== null) out.push(fmt(num));
    num = null;
  };
  const lastToken = () => {
    let i = out.length - 1;
    while (i >= 0 && /^\s*$/.test(out[i])) i -= 1;
    return i;
  };
  for (const w of words) {
    if (w === "") continue;
    if (/^\s+$/.test(w)) {
      if (num === null) out.push(w);
      else pendingSpace = true;
      continue;
    }
    if (w in UNITS) num = (num ?? 0) + UNITS[w];
    else if (w in TENS) num = (num ?? 0) + TENS[w];
    else if (w === "hundred") num = (num ?? 1) * 100;
    else if (w === "thousand" || w === "million" || w === "billion") {
      if (num === null) {
        const i = lastToken();
        if (i >= 0 && /^\d+(\.\d+)?$/.test(out[i])) {
          num = Number(out[i]);
          out.splice(i);
        }
      }
      num = (num ?? 1) * SCALES[w];
      flush();
      pendingSpace = false;
    } else if ((w === "a" || w === "and") && num !== null) {
      // "two hundred and five", "a hundred": part of the number, not a word between numbers.
    } else {
      flush();
      if (pendingSpace) out.push(" ");
      pendingSpace = false;
      out.push(w);
    }
  }
  flush();
  return out.join("").replace(/\s+/g, " ").trim();
}

/**
 * The values a text asserts, as canonical keys: "pct:11", "money:usd:9200000",
 * "date:2023-01", "year:2023", "num:4". With `broad`, the looser forms are
 * emitted as well (a percentage also as its number, a month date also as its
 * year), which is how the allowed set is built: broad on the fact side,
 * specific on the proposed side.
 */
export function valuesOf(text: string, broad = false): Set<string> {
  const out = new Set<string>();
  let t = normaliseNumbers(text);
  t = t.replace(/(\d+(?:\.\d+)?)\s?(%|percent|pct|per cent)(?![a-z])/g, (_, n: string) => {
    out.add(`pct:${fmt(Number(n))}`);
    if (broad) out.add(`num:${fmt(Number(n))}`);
    return " ";
  });
  t = t.replace(/(usd|us\$|eur|gbp|cad|try|\$|€|£)\s?(\d+(?:\.\d+)?)/g, (_, c: string, n: string) => {
    out.add(`money:${CURRENCIES[c]}:${fmt(Number(n))}`);
    if (broad) out.add(`num:${fmt(Number(n))}`);
    return " ";
  });
  t = t.replace(/(\d+(?:\.\d+)?)\s?(usd|eur|gbp|cad|try)\b/g, (_, n: string, c: string) => {
    out.add(`money:${CURRENCIES[c]}:${fmt(Number(n))}`);
    if (broad) out.add(`num:${fmt(Number(n))}`);
    return " ";
  });
  t = t.replace(/\b((?:19|20)\d{2})-(0[1-9]|1[0-2])\b/g, (_, y: string, m: string) => {
    out.add(`date:${y}-${m}`);
    if (broad) out.add(`year:${y}`);
    return " ";
  });
  t = t.replace(/\b([a-z]+)\.? ((?:19|20)\d{2})\b/g, (all, mon: string, y: string) => {
    if (!(mon in MONTHS)) return all;
    out.add(`date:${y}-${MONTHS[mon]}`);
    if (broad) out.add(`year:${y}`);
    return " ";
  });
  t = t.replace(/\b((?:19|20)\d{2})\b/g, (_, y: string) => {
    out.add(`year:${y}`);
    return " ";
  });
  for (const m of t.matchAll(/(?<![a-z\d.])(\d+(?:\.\d+)?)(?![\d.]*[a-z])/g)) out.add(`num:${fmt(Number(m[1]))}`);
  return out;
}

const STOP = new Set(["i", "a", "the", "and", "or", "of", "to", "in", "for", "with", "at", "on", "by", "from", "as", "an"]);

/** Capitalised words and all caps tokens, as the names a line drops. Sentence initial words are skipped. */
export function namesOf(text: string): string[] {
  const names: string[] = [];
  const sentences = text.split(/(?<=[.!?])\s+/);
  for (const s of sentences) {
    const words = s.split(/\s+/);
    let run: string[] = [];
    const flush = () => {
      if (run.length) names.push(run.join(" "));
      run = [];
    };
    words.forEach((raw, i) => {
      const w = raw.replace(/^[("']+|[)",.;:'!?]+$/g, "");
      const cap = /^[A-Z][A-Za-z&.-]*$/.test(w) && !STOP.has(w.toLowerCase());
      const acronym = /^[A-Z][A-Z&]{1,6}$/.test(w);
      if ((cap && i > 0) || acronym) run.push(w);
      else flush();
      // A comma, semicolon or slash after the word ends the name: "SQL, Power BI" is two names, not one.
      if (/[,;/]$/.test(raw)) flush();
    });
    flush();
  }
  return names;
}

export interface FactSet {
  entries: FactEntry[];
  /** Every value of every fact, broad. */
  allowed: Set<string>;
  /** Per fact id, its values, broad. */
  byId: Map<string, Set<string>>;
  /** All fact text, lower case, for the name check. */
  corpus: string;
}

export function factSet(entries: FactEntry[]): FactSet {
  const allowed = new Set<string>();
  const byId = new Map<string, Set<string>>();
  for (const e of entries) {
    const v = valuesOf(e.text, true);
    byId.set(e.id, v);
    for (const k of v) allowed.add(k);
  }
  return { entries, allowed, byId, corpus: entries.map((e) => e.text).join("\n").toLowerCase() };
}

/** Checks one proposed line. Hard for a value in no fact; soft for a name in no fact and for a citation that does not carry a value. */
export function checkLine(line: string, bullet: string | null, cited: string[], facts: FactSet): PacketFinding[] {
  const out: PacketFinding[] = [];
  const values = valuesOf(line);
  for (const v of values) {
    if (!facts.allowed.has(v)) out.push({ level: "hard", bullet, message: "value appears in no confirmed fact", value: v });
  }
  for (const id of cited) if (!facts.byId.has(id)) out.push({ level: "soft", bullet, message: "cited fact does not exist", value: id });
  const citedValues = new Set(cited.flatMap((id) => [...(facts.byId.get(id) ?? [])]));
  if (cited.length) {
    for (const v of values) {
      if (facts.allowed.has(v) && !citedValues.has(v)) out.push({ level: "soft", bullet, message: "value is on the profile but not in the cited facts", value: v });
    }
  }
  for (const n of namesOf(line)) {
    if (!nameOnProfile(n, facts.corpus)) out.push({ level: "soft", bullet, message: "name appears in no confirmed fact", value: n });
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
  if (cs.summary) out.push(...checkLine(cs.summary, "summary", [], facts));
  const skillIds = new Set(base.skills.map((s) => s.id));
  for (const id of cs.skills) if (!skillIds.has(id)) out.push({ level: "soft", bullet: null, message: "no such skill; ignored", value: id });
  return out;
}

export const isHard = (f: PacketFinding[]) => f.some((x) => x.level === "hard");
