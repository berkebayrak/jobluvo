import { normaliseNumbers } from "./normalise";
import type { FactSource } from "@/server/match/profile";

/*
 * The values a text asserts, and nothing else.
 *
 * This module used to read a line the way a reader does: which words a value
 * measured, whether it was a result or a target, which way it moved, whether
 * its predicate denied it, and which predicate segment it belonged to. All of
 * that existed to answer one question, whether a tailored line means what the
 * fact it cites means, and that question is no longer asked (D-034). The
 * comparison is gone, so the machinery behind it is gone with it.
 *
 * What is left is value extraction: every number, amount, percentage, date,
 * duration, count and period in a text, each as a canonical key. One question
 * is asked of those keys, in validate.ts: does this value appear anywhere in
 * the user's confirmed facts. A value that appears nowhere is a hard finding.
 * Whether it appears attached to the same thing is what the tailoring prompt
 * is now responsible for.
 */

export type ClaimKind = "pct" | "money" | "date" | "year" | "duration" | "count" | "period";

export interface Claim {
  /** The canonical value key: "pct:11", "money:usd:9200000", "date:2023-01", "year:2023", "num:4", "period:year", "period:2xyear". */
  key: string;
  kind: ClaimKind;
  /** A number, the date or year text, or for a period the time word with its frequency ("year" for "annually", "2xyear" for "twice a year"). */
  value: number | string;
}

/** A claim from a confirmed fact carries where the fact came from. */
export interface FactClaim extends Claim {
  factId: string;
  role_of_fact: string | null;
  source: FactSource;
}

export const fmt = (n: number) => (Number.isInteger(n) ? String(n) : String(Number(n.toFixed(6))));

const MONTHS = new Map<string, string>([
  ["jan", "01"], ["january", "01"], ["feb", "02"], ["february", "02"], ["mar", "03"], ["march", "03"], ["apr", "04"], ["april", "04"],
  ["may", "05"], ["jun", "06"], ["june", "06"], ["jul", "07"], ["july", "07"], ["aug", "08"], ["august", "08"],
  ["sep", "09"], ["sept", "09"], ["september", "09"], ["oct", "10"], ["october", "10"], ["nov", "11"], ["november", "11"], ["dec", "12"], ["december", "12"],
]);
const CURRENCIES = new Map<string, string>([["usd", "usd"], ["$", "usd"], ["us$", "usd"], ["eur", "eur"], ["€", "eur"], ["gbp", "gbp"], ["£", "gbp"], ["cad", "cad"], ["try", "try"]]);
/** "annually", "a year", "per year", "each quarter": a period is a value, read as its time word. */
const PERIODS = new Map<string, string>([
  ["annually", "year"], ["yearly", "year"], ["year", "year"], ["annum", "year"], ["monthly", "month"], ["month", "month"],
  ["quarterly", "quarter"], ["quarter", "quarter"], ["weekly", "week"], ["week", "week"], ["daily", "day"], ["day", "day"], ["hourly", "hour"], ["hour", "hour"],
]);
/** "once a year" is one, "twice a year" two, "3 times a year" three; a period with no frequency word is once. */
const FREQUENCIES = new Map<string, number>([["once", 1], ["twice", 2], ["thrice", 3]]);

const singular = (w: string) => (w.length > 3 && w.endsWith("s") && !w.endsWith("ss") ? w.slice(0, -1) : w);

/**
 * Objects that name no domain: "present progress", "deliver results",
 * "share recommendations". Claiming one asserts nothing, so one is not a
 * responsibility (entities.ts). Kept here because entities.ts reads it.
 */
export const GENERIC_OBJECTS = new Set([
  "progress", "result", "results", "update", "updates", "recommendation", "recommendations", "decision", "decisions", "outcome", "outcomes", "priority", "priorities",
  "plan", "plans", "finding", "findings", "option", "options", "proposal", "proposals", "insight", "insights", "material", "materials", "input", "inputs", "output", "outputs",
  "status", "summary", "summaries", "report", "reports", "practice", "practices", "process", "processes", "initiative", "initiatives", "work", "effort", "efforts",
  "value", "impact", "improvement", "improvements", "change", "changes", "growth", "success",
]);

/** Irregular pasts to their lemma, for the few verbs resumes lean on. */
const IRREGULAR = new Map<string, string>([
  ["built", "build"], ["led", "lead"], ["ran", "run"], ["grew", "grow"], ["sold", "sell"], ["held", "hold"], ["won", "win"], ["drove", "drive"], ["made", "make"],
  ["took", "take"], ["wrote", "write"], ["brought", "bring"], ["kept", "keep"], ["met", "meet"], ["oversaw", "oversee"], ["rebuilt", "rebuild"], ["taught", "teach"],
]);

/**
 * The same word in another form is the same word: "removing", "removed" and
 * "removes" are "remove". Crude on purpose; it decides whether a word is on
 * the profile, never what a line means.
 */
export function lemma(w0: string): string {
  const w = w0.toLowerCase();
  const irregular = IRREGULAR.get(w);
  if (irregular) return irregular;
  if (w.length <= 3) return w;
  if (w.endsWith("ies") && w.length > 4) return `${w.slice(0, -3)}y`;
  if (w.endsWith("ing") && w.length > 5) return w.slice(0, -3).replace(/(.)\1$/, "$1") + (/[^aeiou][^aeiouy]$/.test(w.slice(0, -3)) ? "e" : "");
  if (w.endsWith("ed") && w.length > 4) return w.slice(0, -2).replace(/(.)\1$/, "$1");
  if (w.endsWith("es") && w.length > 4) return w.slice(0, -2);
  if (w.endsWith("s") && !w.endsWith("ss")) return w.slice(0, -1);
  return w;
}

/** Words a counted noun run stops at. */
const RUN_STOP = new Set([
  "a", "an", "the", "and", "or", "of", "to", "in", "for", "with", "at", "on", "by", "from", "as", "over", "across", "per", "than", "into",
  "through", "via", "that", "this", "which", "its", "their", "our", "is", "was", "were", "be", "been", "are", "it", "we", "i",
  "percent", "pct", "usd", "eur", "gbp", "cad", "try", "million", "thousand", "billion",
  "not", "never", "no", "without", "did", "does", "do",
]);

const TIME_UNITS = new Map<string, string>([
  ["yr", "year"], ["yrs", "year"], ["hrs", "hour"], ["hr", "hour"],
]);

/** The value pattern, alternatives in priority order at each position: money, percentage, period with its frequency, month date, dash date, bare year, duration, count. A hyphen before a digit that follows nothing alphanumeric is a sign, and the normaliser keeps it. */
const VALUE_SOURCE = [
  String.raw`(?<cur>usd|us\$|eur|gbp|cad|try|\$|€|£)\s?(?<curn>\d+(?:\.\d+)?)`,
  String.raw`(?<mn>\d+(?:\.\d+)?)\s?(?<mcur>usd|eur|gbp|cad|try)\b`,
  String.raw`(?<pn>\d+(?:\.\d+)?)\s?(?:%|percent|pct|per cent)(?![a-z])`,
  String.raw`(?<![a-z\d.])(?<![a-z\d]-)(?:(?<freq>once|twice|thrice|\d+ times|\d+x)\s+)?(?<per>annually|yearly|monthly|quarterly|weekly|daily|hourly|(?:per|a|each|every) (?:year|annum|month|quarter|week|day|hour))(?![a-z])`,
  String.raw`\b(?<dy>(?:19|20)\d{2})-(?<dm>0[1-9]|1[0-2])\b`,
  String.raw`\b(?<mon>jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t|tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\.? (?<my>(?:19|20)\d{2})\b(?!-)`,
  // A four digit number after a time preposition is a year whatever follows, "in 2023 revenue grew"; elsewhere it is a year only when nothing,
  // punctuation or a function word follows, and a count when a plain word does, "2000 customers", "a study of 2000 customers".
  String.raw`(?<=\b(?:in|since|by|from|to|until|till|during|before|after|for|through|mid|late|early|between|and|or)\s)(?<yp>(?:19|20)\d{2})\b(?![\d-])(?!\.\d)`,
  String.raw`\b(?<y>(?:19|20)\d{2})\b(?![\d-])(?!\.\d)(?!\s+(?!(?:to|and|or|until|till|through|when|while|as|with|at|by|for|in|on|of|the|a|an|which|that|but|we|i|it|after|before|during|since|so|then|now|where|who|our|its|their|this|these|those|per|across|against|versus|vs)\b)[a-z])`,
  String.raw`(?<![a-z\d.])(?<![a-z\d]-)(?<dn>\d+(?:\.\d+)?)\s?(?<du>years?|yrs?|months?|weeks?|days?|hours?|hrs?|quarters?)\b`,
  String.raw`(?<![a-z\d.])(?<![a-z\d]-)(?<n>\d+(?:\.\d+)?)(?![\d.]*[a-z])`,
].join("|");
const VALUE = new RegExp(VALUE_SOURCE, "g");

/**
 * The values a text asserts, one claim per value found, over the whole
 * normalised text. No sentence or predicate splitting: nothing downstream
 * asks which predicate a value belongs to any more, and reading the text
 * whole keeps the pattern's own lookbehinds intact at boundaries a split
 * would have broken.
 */
export function claimsOf(text: string): Claim[] {
  const out: Claim[] = [];
  const norm = normaliseNumbers(text);
  for (const m of norm.matchAll(VALUE)) {
    const g = m.groups ?? {};
    const at = m.index!;
    // A sign the normaliser kept: "-11 percent" is not 11 percent.
    const negative = at > 0 && norm[at - 1] === "-" && !/[a-z0-9]/.test(norm[at - 2] ?? "");
    const signed = (n: number) => (negative ? -n : n);
    if (g.cur || g.mcur) {
      const value = signed(Number(g.curn ?? g.mn));
      const unit = CURRENCIES.get(g.cur ?? g.mcur) ?? null;
      out.push({ key: `money:${unit}:${fmt(value)}`, kind: "money", value });
    } else if (g.pn) {
      const value = signed(Number(g.pn));
      out.push({ key: `pct:${fmt(value)}`, kind: "pct", value });
    } else if (g.per) {
      const unit = PERIODS.get(g.per.split(" ").pop()!) ?? null;
      const f = g.freq;
      const times = f === undefined ? 1 : (FREQUENCIES.get(f) ?? Number(/\d+/.exec(f)?.[0] ?? 1));
      const value = times === 1 ? String(unit) : `${times}x${unit}`;
      out.push({ key: `period:${value}`, kind: "period", value });
    } else if (g.mon) {
      const month = MONTHS.get(g.mon);
      // "since 2023" style words are not months; read the year on its own.
      if (month === undefined) out.push({ key: `year:${g.my}`, kind: "year", value: g.my });
      else out.push({ key: `date:${g.my}-${month}`, kind: "date", value: `${g.my}-${month}` });
    } else if (g.dy) {
      out.push({ key: `date:${g.dy}-${g.dm}`, kind: "date", value: `${g.dy}-${g.dm}` });
    } else if (g.y || g.yp) {
      const value = g.y ?? g.yp;
      out.push({ key: `year:${value}`, kind: "year", value });
    } else if (g.dn) {
      const value = signed(Number(g.dn));
      out.push({ key: `num:${fmt(value)}`, kind: "duration", value });
    } else {
      const value = signed(Number(g.n));
      out.push({ key: `num:${fmt(value)}`, kind: "count", value });
    }
  }
  return out;
}

/**
 * True when the two claims carry the same value: the same canonical key, or
 * a month date read as its year.
 *
 * The key and not the bare number, because the key is where the kind and the
 * currency live. While `contradiction` existed it caught a percentage that
 * had become a count and euros that had become dollars, so a looser test here
 * was safe. It is not safe now: comparing numbers alone let "EUR 9.2M" pass on
 * a profile holding USD 9.2M, and "10 percent" pass on a profile holding
 * 10 years. Caught by the tests when the comparison came out (D-034).
 */
export function sameValue(fact: Claim, line: Claim): boolean {
  if (fact.key === line.key) return true;
  return fact.kind === "date" && line.kind === "year" && String(fact.value).startsWith(String(line.value));
}

export { singular, RUN_STOP, TIME_UNITS };
