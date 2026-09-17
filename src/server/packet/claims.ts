import type { FactSource } from "@/server/match/profile";
import { normaliseNumbers } from "./normalise";

/*
 * A claim is one value in one line, with what the line says about it: what
 * kind of value it is, its unit, the words it measures, whether it is a
 * result or a target, and which way it moved. Claims are built the same
 * way from a confirmed fact and from a line the model proposes, and the
 * validator matches the line's claims against the claims of the facts the
 * line cites. "The number is in a cited fact" is not enough: "reduced churn
 * by 11 percent" and "managed 11 teams" share a number and nothing else.
 *
 * Reading is deterministic and crude on purpose. Kind, unit and role are
 * mechanical, and a mismatch there is a contradiction. The metric words
 * are a stop word filtered clause and shared words are a poor synonym test,
 * so a metric mismatch is held for review, never rejected.
 */

export type ClaimKind = "pct" | "money" | "date" | "year" | "duration" | "count" | "period";
export type ClaimRole = "result" | "target" | "baseline";

export interface Claim {
  /** The value key the old validator used, kept so findings read the same: "pct:11", "money:usd:9200000", "date:2023-01", "year:2023", "num:4". */
  key: string;
  kind: ClaimKind;
  /** A number, the date or year text, or for a period the time word ("year" for "annually", "a year", "per year"). */
  value: number | string;
  /** The currency, the time word, or the counted noun, singular; null when the line names none. */
  unit: string | null;
  /** For a count, the words after the number up to the first stop word, singular: "14 fleet software acquisition targets" keeps all four, so either side's noun can be found in the other's run. */
  nounRun: string[];
  /** Content words of the value's own predicate, stop words, the predicate's verb and the value's own words removed. */
  metric: string[];
  /** Content words of the whole sentence the value sits in. A fact's sentence is the user's truth, and a line may draw its words from any of it. */
  sentence: string[];
  role: ClaimRole;
  direction: "up" | "down" | null;
  /** The predicate segment the value sits in, for the review screen. */
  clause: string;
}

/** A claim from a confirmed fact carries where the fact came from. */
export interface FactClaim extends Claim {
  factId: string;
  role_of_fact: string | null;
  source: FactSource;
}

const fmt = (n: number) => (Number.isInteger(n) ? String(n) : String(Number(n.toFixed(6))));

const MONTHS: Record<string, string> = {
  jan: "01", january: "01", feb: "02", february: "02", mar: "03", march: "03", apr: "04", april: "04", may: "05",
  jun: "06", june: "06", jul: "07", july: "07", aug: "08", august: "08", sep: "09", sept: "09", september: "09",
  oct: "10", october: "10", nov: "11", november: "11", dec: "12", december: "12",
};
const CURRENCIES: Record<string, string> = { usd: "usd", $: "usd", us$: "usd", eur: "eur", "€": "eur", gbp: "gbp", "£": "gbp", cad: "cad", try: "try" };
/** "annually", "a year", "per year", "each quarter": a period is a claim about how often, read as its time word. */
const PERIODS: Record<string, string> = {
  annually: "year", yearly: "year", year: "year", annum: "year", monthly: "month", month: "month", quarterly: "quarter", quarter: "quarter",
  weekly: "week", week: "week", daily: "day", day: "day", hourly: "hour", hour: "hour",
};
const TIME_UNITS: Record<string, string> = {
  year: "year", years: "year", yr: "year", yrs: "year", month: "month", months: "month", week: "week", weeks: "week",
  day: "day", days: "day", hour: "hour", hours: "hour", hr: "hour", hrs: "hour", quarter: "quarter", quarters: "quarter",
};

const DOWN = new Set(["reduced", "reduce", "reducing", "cut", "cutting", "lowered", "lower", "lowering", "decreased", "decrease", "saved", "saving", "savings", "fell", "shrank", "declined", "down", "halved"]);
const UP = new Set(["grew", "grow", "growing", "growth", "increased", "increase", "increasing", "raised", "raise", "raising", "added", "adding", "expanded", "expand", "improved", "improve", "rose", "doubled", "tripled", "lifted", "lift", "lifts", "lifting", "up", "boosted", "boost"]);
/** Words that make the value after them a target ("against a 12 percent target") ... */
const PRE_TARGET = new Set(["against", "versus", "vs"]);
/** ... and words that make the value they follow, or the value after "target of", a target. */
const POST_TARGET = new Set(["target", "targets", "goal", "goals", "budget", "budgeted", "forecast", "objective", "objectives"]);
const TARGET = new Set([...PRE_TARGET, ...POST_TARGET]);
const STOP = new Set([
  "a", "an", "the", "and", "or", "of", "to", "in", "for", "with", "at", "on", "by", "from", "as", "over", "across", "per", "than", "into",
  "through", "via", "that", "this", "which", "its", "their", "our", "his", "her", "is", "was", "were", "be", "been", "are", "it", "we", "i",
  "now", "then", "after", "before", "while", "within", "under", "about", "around", "up", "down", "out", "one", "each", "every", "all", "any",
  "some", "more", "most", "less", "least", "very", "also", "both", "such", "so", "not", "no", "yes", "but", "if", "when", "where", "who",
  "percent", "pct", "usd", "eur", "gbp", "cad", "try", "million", "thousand", "billion", "k", "m", "bn", "mn", "b", "a", "year", "years",
  "month", "months", "week", "weeks", "day", "days", "hour", "hours", "quarter", "quarters", "since", "until", "till", "present", "current",
  "annually", "annual", "yearly", "monthly", "quarterly", "weekly", "daily", "roughly", "about", "around", "approximately", "nearly", "almost",
]);

const singular = (w: string) => (w.length > 3 && w.endsWith("s") && !w.endsWith("ss") ? w.slice(0, -1) : w);

/** Irregular pasts to their lemma, for the few verbs resumes lean on. */
const IRREGULAR: Record<string, string> = { built: "build", led: "lead", ran: "run", grew: "grow", sold: "sell", held: "hold", won: "win", drove: "drive", made: "make", took: "take", wrote: "write", brought: "bring", kept: "keep", met: "meet", oversaw: "oversee", rebuilt: "rebuild" };

/**
 * The same word in another form is the same word: "removing", "removed"
 * and "remove"; "workstream" and "workstreams"; "led" and "lead". Metric
 * words are compared as lemmas so that an inflection is never a changed
 * measure. Crude on purpose, and applied to both sides alike.
 */
export function lemma(w0: string): string {
  if (Object.hasOwn(IRREGULAR, w0)) return lemma(IRREGULAR[w0]);
  let w = w0;
  if (w.endsWith("ies")) w = w.slice(0, -3) + "y";
  else w = singular(w);
  if (w.length > 5 && w.endsWith("ing")) w = w.slice(0, -3);
  else if (w.length > 4 && w.endsWith("ed")) w = w.slice(0, -2);
  if (w.length > 3 && w.endsWith("e")) w = w.slice(0, -1);
  if (w.length > 3 && w[w.length - 1] === w[w.length - 2] && /[bdgmnprt]/.test(w[w.length - 1])) w = w.slice(0, -1);
  return w;
}

/** The value pattern, alternatives in priority order at each position: money, percentage, period, month date, dash date, bare year, duration, count. */
const VALUE_SOURCE = [
    String.raw`(?<cur>usd|us\$|eur|gbp|cad|try|\$|€|£)\s?(?<curn>\d+(?:\.\d+)?)`,
    String.raw`(?<mn>\d+(?:\.\d+)?)\s?(?<mcur>usd|eur|gbp|cad|try)\b`,
    String.raw`(?<pn>\d+(?:\.\d+)?)\s?(?:%|percent|pct|per cent)(?![a-z])`,
    String.raw`(?<![a-z\d.-])(?<per>annually|yearly|monthly|quarterly|weekly|daily|hourly|(?:per|a|each|every) (?:year|annum|month|quarter|week|day|hour))(?![a-z])`,
    String.raw`\b(?<dy>(?:19|20)\d{2})-(?<dm>0[1-9]|1[0-2])\b`,
    String.raw`\b(?<mon>[a-z]+)\.? (?<my>(?:19|20)\d{2})\b(?!-)`,
    String.raw`\b(?<y>(?:19|20)\d{2})\b(?![\d.-])`,
    String.raw`(?<![a-z\d.-])(?<dn>\d+(?:\.\d+)?)\s?(?<du>years?|yrs?|months?|weeks?|days?|hours?|hrs?|quarters?)\b`,
    String.raw`(?<![a-z\d.-])(?<n>\d+(?:\.\d+)?)(?![\d.]*[a-z])`,
].join("|");
const VALUE = new RegExp(VALUE_SOURCE, "g");
const HAS_VALUE = new RegExp(VALUE_SOURCE);
/** Where one predicate ends and the next begins inside a clause: "increased revenue by 20 percent and reduced cost by 10 percent". */
const PREDICATE = /\s+(?:and|while)\s+/;

/**
 * A clause's predicate segments: the clause split at "and" and "while",
 * with every piece that carries no value folded into the piece before it,
 * or the piece after it when it comes first. "Designed and ran a program
 * that cut cost 11 percent" stays one segment; "increased revenue by 20
 * percent and reduced cost by 10 percent" is two. Each value then reads
 * its words and its direction from its own predicate and nothing borrows
 * from the rest of the sentence.
 */
export function segmentsOf(clause: string): string[] {
  const out: string[] = [];
  let carry = "";
  for (const piece of clause.split(PREDICATE)) {
    const text = carry ? `${carry} and ${piece}` : piece;
    carry = "";
    if (HAS_VALUE.test(text)) out.push(text);
    else if (out.length) out[out.length - 1] += ` and ${text}`;
    else carry = text;
  }
  if (carry) {
    if (out.length) out[out.length - 1] += ` and ${carry}`;
    else out.push(carry);
  }
  return out;
}

/** The claims a text makes, one per value found. */
export function claimsOf(text: string): Claim[] {
  const out: Claim[] = [];
  const norm = normaliseNumbers(text);
  for (const sentence of norm.split(/(?<=[.;:!?])\s+|\n/)) {
    const clauses = sentence.split(/,\s+(?=(?:and |but |which |while )?[a-z])/);
    // A segment with no words of its own, "or USD 9.2M a year" after "cut cost 11 percent", is an apposition: it measures what the segment before it measured.
    let inherited: string[] = [];
    const sentenceWords = [...new Set(sentence.split(/[^a-z0-9]+/).filter((w) => w && !/\d/.test(w) && !STOP.has(w) && !DOWN.has(w) && !UP.has(w) && !TARGET.has(w) && w.length > 1).map(singular))];
    for (const clause of clauses.flatMap(segmentsOf)) {
      const words = clause.split(/[^a-z0-9]+/).filter(Boolean);
      const direction = words.some((w) => DOWN.has(w)) === words.some((w) => UP.has(w)) ? null : words.some((w) => DOWN.has(w)) ? "down" : "up";
      const matches = [...clause.matchAll(VALUE)];
      const content = (ws: string[]) => [...new Set(ws.filter((w) => !/\d/.test(w) && !STOP.has(w) && !DOWN.has(w) && !UP.has(w) && !TARGET.has(w) && w.length > 1).map(singular))];
      // A resume predicate opens with its verb: "Led a 3 year cost program", "Designed and ran". The verb says what the person did,
      // not what the value measures, so it is not a metric word; "Led" for "Ran" is a rewording. Kept when it is the only word,
      // "Revenue grew 20 percent" measures revenue.
      const all = content(words);
      const lead = words.find((w) => !/\d/.test(w));
      const metricWords = lead && all[0] === singular(lead) && all.length > 1 ? all.slice(1) : all;
      const read = matches.map((m) => {
        const g = m.groups ?? {};
        let kind: ClaimKind;
        let value: number | string;
        let unit: string | null = null;
        let key: string;
        const nounWords: string[] = [];
        if (g.cur || g.mcur) {
          kind = "money";
          value = Number(g.curn ?? g.mn);
          unit = CURRENCIES[g.cur ?? g.mcur];
          key = `money:${unit}:${fmt(value)}`;
        } else if (g.pn) {
          kind = "pct";
          value = Number(g.pn);
          key = `pct:${fmt(value)}`;
        } else if (g.per) {
          kind = "period";
          unit = PERIODS[g.per.split(" ").pop()!];
          value = unit;
          key = `period:${unit}`;
        } else if (g.mon) {
          if (!(g.mon in MONTHS)) {
            // "since 2023" style words are not months; read the year on its own.
            kind = "year";
            value = g.my;
            key = `year:${g.my}`;
          } else {
            kind = "date";
            value = `${g.my}-${MONTHS[g.mon]}`;
            key = `date:${value}`;
          }
        } else if (g.dy) {
          kind = "date";
          value = `${g.dy}-${g.dm}`;
          key = `date:${value}`;
        } else if (g.y) {
          kind = "year";
          value = g.y;
          key = `year:${g.y}`;
        } else if (g.dn) {
          kind = "duration";
          value = Number(g.dn);
          unit = TIME_UNITS[g.du] ?? singular(g.du);
          key = `num:${fmt(value)}`;
        } else {
          kind = "count";
          value = Number(g.n);
          // The counted noun is the head of the run after the number: "4 strategy managers" counts managers, "38 teams" teams.
          const run = /^\s*(?:of\s+)?((?:[a-z][a-z-]*\s+){0,4}[a-z][a-z-]*)/.exec(clause.slice(m.index! + m[0].length));
          for (const w of (run?.[1] ?? "").split(/\s+/)) {
            if (!w || STOP.has(w) || DOWN.has(w) || UP.has(w) || PRE_TARGET.has(w) || /\d/.test(w)) break;
            nounWords.push(w);
          }
          unit = nounWords.length ? singular(nounWords[nounWords.length - 1]) : null;
          key = `num:${fmt(value)}`;
        }
        return { m, kind, value, unit, key, nounWords };
      });
      read.forEach((r, i) => {
        const { m, kind, value, unit, key, nounWords } = r;
        // Role: the words between the previous value and the next one belong to this value, less the previous value's own noun run.
        const from = i === 0 ? 0 : read[i - 1].m.index! + read[i - 1].m[0].length;
        const to = i + 1 < read.length ? read[i + 1].m.index! : clause.length;
        const before = clause.slice(from, m.index!).split(/[^a-z]+/).filter(Boolean).slice(i === 0 ? 0 : read[i - 1].nounWords.length);
        const after = clause.slice(m.index! + m[0].length, to).split(/[^a-z]+/).filter(Boolean).slice(nounWords.length);
        let role: ClaimRole = "result";
        // "against a 12 percent target": the words before 12 carry "against", the words after it carry "target"; neither belongs to the 11 before them.
        // A period has no role: "present targets to the board twice a year" is how often, whatever is presented.
        if (kind !== "period" && (before.some((w) => TARGET.has(w)) || after.some((w) => POST_TARGET.has(w)))) role = "target";
        // "from 7 to 5", "11 units into 6": the first value is the baseline and the second the result.
        const prev = before.slice(-2);
        const next = i + 1 < read.length;
        const last = after[after.length - 1];
        if (next && (prev.includes("from") || last === "to" || last === "into")) role = "baseline";
        const nounRun = nounWords.map(singular);
        const own = new Set([...nounRun, ...(unit ? [unit] : [])]);
        const segmentMetric = metricWords.filter((w) => !own.has(w));
        const metric = segmentMetric.length ? segmentMetric : inherited.filter((w) => !own.has(w));
        out.push({ key, kind, value, unit, nounRun, metric, sentence: sentenceWords, role, direction: kind === "date" || kind === "year" || kind === "period" ? null : direction, clause: clause.trim() });
      });
      const ownWords = new Set(read.flatMap((r) => [...r.nounWords.map(singular), ...(r.unit ? [r.unit] : [])]));
      const segmentWords = metricWords.filter((w) => !ownWords.has(w));
      if (segmentWords.length) inherited = segmentWords;
    }
  }
  return out;
}

/** True when the two claims carry the same value: the same number, the same date, or a month date read as its year. */
export function sameValue(fact: Claim, line: Claim): boolean {
  if (typeof fact.value === "number" && typeof line.value === "number") return fact.value === line.value;
  if (typeof fact.value === "string" && typeof line.value === "string") {
    if (fact.value === line.value) return true;
    return fact.kind === "date" && line.kind === "year" && fact.value.startsWith(line.value);
  }
  return false;
}

/**
 * Why a fact claim with the same value does not support the line's claim,
 * or null when it does. Kind, unit, role and direction are mechanical:
 * a percentage that became a count, months that became years, a target
 * that became a result, a fall that became a rise. Each is a contradiction
 * the model can fix from the finding, so each is hard.
 */
export function contradiction(fact: Claim, line: Claim): string | null {
  if (fact.kind === "date" && line.kind === "year") return null;
  if (fact.kind !== line.kind) return `${describe(fact)} became ${describe(line)}`;
  if (fact.kind === "money" || fact.kind === "duration") {
    if (fact.unit !== line.unit) return `${describe(fact)} became ${describe(line)}`;
  }
  if (fact.kind === "count" && fact.unit && line.unit && fact.unit !== line.unit && !line.nounRun.includes(fact.unit) && !fact.nounRun.includes(line.unit)) {
    return `${describe(fact)} became ${describe(line)}`;
  }
  if (fact.role !== line.role) return `a ${fact.role} became a ${line.role}`;
  if (fact.direction && line.direction && fact.direction !== line.direction) return `${fact.direction} became ${line.direction}`;
  return null;
}

/** "11 percent", "USD 9200000", "12 months", "11 teams", "a count", "2023-01". */
export function describe(c: Claim): string {
  switch (c.kind) {
    case "pct":
      return `${c.value} percent`;
    case "money":
      return `${c.unit?.toUpperCase()} ${c.value}`;
    case "duration":
      return `${c.value} ${c.unit}${c.value === 1 ? "" : "s"}`;
    case "count":
      return c.unit ? `${c.value} ${c.unit}${c.value === 1 ? "" : "s"}` : `a count of ${c.value}`;
    case "period":
      return `per ${c.value}`;
    default:
      return String(c.value);
  }
}

/**
 * Whether the two sides measure the same thing, as far as words can tell:
 * yes when every metric word of the line's predicate is in the fact's
 * sentence, unreadable when either side has none to compare, differ
 * otherwise. One shared word is not agreement: "customer churn" and
 * "customer acquisition costs" share a word and measure different things.
 * The line's side is its own predicate, so a value cannot borrow words
 * from elsewhere in the line; the fact's side is its whole sentence, so a
 * line that folds the fact's own descriptive clauses into one predicate
 * still passes. The hole that leaves, named here so it is not
 * rediscovered: a fact sentence with two predicates, "reduced churn 11
 * percent, and cut acquisition cost 5 percent", supports a line that
 * pairs 11 percent with acquisition cost, when the direction agrees. Dates,
 * years and periods are exempt; their meaning is the value and the role.
 */
export function metricsAgree(fact: Claim, line: Claim): "yes" | "differ" | "unreadable" {
  if (fact.kind === "date" || fact.kind === "year" || fact.kind === "period") return "yes";
  // "6 analysts" against "6 analysts": the counted noun is the metric, and it matched already.
  const factSentence = new Set(fact.sentence.map(lemma));
  if (fact.kind === "count" || line.kind === "count") {
    const factNouns = [...fact.nounRun, ...(fact.unit ? [fact.unit] : [])].map(lemma);
    const lineNouns = [...line.nounRun, ...(line.unit ? [line.unit] : [])].map(lemma);
    const lineMetric = new Set(line.metric.map(lemma));
    const factMetric = new Set(fact.metric.map(lemma));
    // "team of 6" against "6 team members": the noun on one side is a metric word or the noun on the other.
    if (factNouns.some((w) => lineNouns.includes(w) || lineMetric.has(w)) || lineNouns.some((w) => factMetric.has(w))) return "yes";
  }
  if (!fact.metric.length || !line.metric.length) return "unreadable";
  return line.metric.every((w) => factSentence.has(lemma(w))) ? "yes" : "differ";
}
