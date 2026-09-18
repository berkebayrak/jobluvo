import type { FactSource } from "@/server/match/profile";
import { normaliseNumbers } from "./normalise";

/*
 * A claim is one value in one line, with what the line says about it: what
 * kind of value it is, its unit, the words it measures, whether it is a
 * result or a target, which way it moved, whether it is a change or a
 * level, whether the predicate denies it, and the verb that opens the
 * predicate. Claims are built the same way from a confirmed fact and from a
 * line the model proposes, and the validator matches the line's claims
 * against the claims of the facts the line cites. "The number is in a cited
 * fact" is not enough: "reduced churn by 11 percent" and "managed 11 teams"
 * share a number and nothing else.
 *
 * Reading is deterministic and crude on purpose. Kind, unit, role,
 * direction, relation and negation are mechanical, and a mismatch there is
 * a contradiction. The metric words are a stop word filtered clause and
 * shared words are a poor synonym test, so a metric mismatch is held for
 * review, never rejected.
 *
 * Review four, finding 3, closed the readings that let a changed meaning
 * through: a value now keeps its own predicate's words apart from a sibling
 * value's in the same fact sentence (A), the opening verb is a relationship
 * and "trained" is not "managed" (B), a denial is read (C), "by" and "to"
 * are different claims (D), and a minus sign is part of the number (E).
 * Finding 4: a period carries its frequency, "twice a year" is not
 * "annually", and it is bound to its own predicate like every other value.
 */

export type ClaimKind = "pct" | "money" | "date" | "year" | "duration" | "count" | "period";
export type ClaimRole = "result" | "target" | "baseline";
/** "by" for a change, "to" for a level: "reduced churn by 11 percent" and "reduced churn to 11 percent" are different claims. */
export type ClaimRelation = "by" | "to";

export interface Claim {
  /** The value key the old validator used, kept so findings read the same: "pct:11", "money:usd:9200000", "date:2023-01", "year:2023", "num:4", "period:year", "period:2xyear". */
  key: string;
  kind: ClaimKind;
  /** A number, the date or year text, or for a period the time word with its frequency ("year" for "annually", "2xyear" for "twice a year"). */
  value: number | string;
  /** The currency, the time word, or the counted noun, singular; null when the line names none. */
  unit: string | null;
  /** For a count, the words after the number up to the first stop word, singular: "14 fleet software acquisition targets" keeps all four, so either side's noun can be found in the other's run. */
  nounRun: string[];
  /** Content words of the value's own predicate, stop words, the predicate's verb and the value's own words removed. */
  metric: string[];
  /** Content words of the whole sentence the value sits in. A fact's sentence is the user's truth, and a line may draw its words from any of it. */
  sentence: string[];
  /** Content words of the other values' predicates in the same sentence, less this value's own: the part of the sentence a line may not take for this value. */
  others: string[];
  /** The lemma of the verb that opens the value's predicate when the resume style gives one: "train" for "Trained 6 analysts". Not a metric word; a relationship. */
  verb: string | null;
  relation: ClaimRelation | null;
  /** The predicate denies the value: "did not manage 6 analysts". */
  negated: boolean;
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

// Every table a word from a line is looked up in is a Map: a Record indexed by "constructor" answers with Object.prototype's.
const MONTHS = new Map<string, string>([
  ["jan", "01"], ["january", "01"], ["feb", "02"], ["february", "02"], ["mar", "03"], ["march", "03"], ["apr", "04"], ["april", "04"], ["may", "05"],
  ["jun", "06"], ["june", "06"], ["jul", "07"], ["july", "07"], ["aug", "08"], ["august", "08"], ["sep", "09"], ["sept", "09"], ["september", "09"],
  ["oct", "10"], ["october", "10"], ["nov", "11"], ["november", "11"], ["dec", "12"], ["december", "12"],
]);
const CURRENCIES = new Map<string, string>([["usd", "usd"], ["$", "usd"], ["us$", "usd"], ["eur", "eur"], ["€", "eur"], ["gbp", "gbp"], ["£", "gbp"], ["cad", "cad"], ["try", "try"]]);
/** "annually", "a year", "per year", "each quarter": a period is a claim about how often, read as its time word. */
const PERIODS = new Map<string, string>([
  ["annually", "year"], ["yearly", "year"], ["year", "year"], ["annum", "year"], ["monthly", "month"], ["month", "month"], ["quarterly", "quarter"], ["quarter", "quarter"],
  ["weekly", "week"], ["week", "week"], ["daily", "day"], ["day", "day"], ["hourly", "hour"], ["hour", "hour"],
]);
/** "once a year" is one, "twice a year" two, "3 times a year" three; a period with no frequency word is once. */
const FREQUENCIES = new Map<string, number>([["once", 1], ["twice", 2], ["thrice", 3]]);
const TIME_UNITS = new Map<string, string>([
  ["year", "year"], ["years", "year"], ["yr", "year"], ["yrs", "year"], ["month", "month"], ["months", "month"], ["week", "week"], ["weeks", "week"],
  ["day", "day"], ["days", "day"], ["hour", "hour"], ["hours", "hour"], ["hr", "hour"], ["hrs", "hour"], ["quarter", "quarter"], ["quarters", "quarter"],
]);

const DOWN = new Set(["reduced", "reduce", "reducing", "cut", "cutting", "lowered", "lower", "lowering", "decreased", "decrease", "saved", "saving", "savings", "fell", "shrank", "declined", "down", "halved"]);
const UP = new Set(["grew", "grow", "growing", "growth", "increased", "increase", "increasing", "raised", "raise", "raising", "added", "adding", "expanded", "expand", "improved", "improve", "rose", "doubled", "tripled", "lifted", "lift", "lifts", "lifting", "up", "boosted", "boost"]);
/** Words that make the value after them a target ("against a 12 percent target") ... */
const PRE_TARGET = new Set(["against", "versus", "vs"]);
/** ... and words that make the value they follow, or the value after "target of", a target. */
const POST_TARGET = new Set(["target", "targets", "goal", "goals", "budget", "budgeted", "forecast", "objective", "objectives"]);
const TARGET = new Set([...PRE_TARGET, ...POST_TARGET]);
/** The predicate denies what follows. After the normaliser "didn't" is "didn t". */
const NEGATION = new Set(["not", "never", "no", "without", "didn", "wasn", "weren", "don", "doesn", "hasn", "haven", "neither", "nor"]);
/** Words between a relation word and its value that carry no meaning of their own: "by about 11 percent". */
const HEDGES = new Set(["about", "around", "approximately", "roughly", "nearly", "almost", "over", "under", "some", "a", "an", "the", "just"]);
const STOP = new Set([
  "a", "an", "the", "and", "or", "of", "to", "in", "for", "with", "at", "on", "by", "from", "as", "over", "across", "per", "than", "into",
  "through", "via", "that", "this", "which", "its", "their", "our", "his", "her", "is", "was", "were", "be", "been", "are", "it", "we", "i",
  "now", "then", "after", "before", "while", "within", "under", "about", "around", "up", "down", "out", "one", "each", "every", "all", "any",
  "some", "more", "most", "less", "least", "very", "also", "both", "such", "so", "not", "no", "yes", "but", "if", "when", "where", "who",
  "percent", "pct", "usd", "eur", "gbp", "cad", "try", "million", "thousand", "billion", "k", "m", "bn", "mn", "b", "a", "year", "years",
  "month", "months", "week", "weeks", "day", "days", "hour", "hours", "quarter", "quarters", "since", "until", "till", "present", "current",
  "annually", "annual", "yearly", "monthly", "quarterly", "weekly", "daily", "roughly", "about", "around", "approximately", "nearly", "almost",
  "once", "twice", "thrice", "times", "did", "does", "do", "never", "without",
]);

const singular = (w: string) => (w.length > 3 && w.endsWith("s") && !w.endsWith("ss") ? w.slice(0, -1) : w);

/**
 * Objects that name no domain: "present progress", "deliver results",
 * "share recommendations". Claiming one asserts nothing a fact could
 * contradict, so one is neither a responsibility (entities.ts) nor a
 * metric word here: "present progress to the board twice a year" measures
 * what "presented to the board twice a year" measures.
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
 * The same word in another form is the same word: "removing", "removed"
 * and "remove"; "workstream" and "workstreams"; "led" and "lead". Metric
 * words are compared as lemmas so that an inflection is never a changed
 * measure. Crude on purpose, and applied to both sides alike.
 */
export function lemma(w0: string): string {
  const irregular = IRREGULAR.get(w0);
  if (irregular !== undefined) return lemma(irregular);
  let w = w0;
  if (w.endsWith("ies")) w = w.slice(0, -3) + "y";
  else w = singular(w);
  if (w.length > 5 && w.endsWith("ing")) w = w.slice(0, -3);
  else if (w.length > 4 && w.endsWith("ed")) w = w.slice(0, -2);
  if (w.length > 3 && w.endsWith("e")) w = w.slice(0, -1);
  if (w.length > 3 && w[w.length - 1] === w[w.length - 2] && /[bdgmnprt]/.test(w[w.length - 1])) w = w.slice(0, -1);
  return w;
}

/**
 * Verbs that name different relationships to the same object. "Led" for
 * "Ran" is a rewording; "Managed" for "Trained" is a different claim about
 * the same 6 analysts (review four, finding 3B). A verb in no group gives
 * no opinion. Closed and small on purpose; a posting cannot add to it.
 */
const VERB_GROUPS = new Map<string, string>();
for (const [group, verbs] of [
  ["manage", ["lead", "manage", "run", "head", "oversee", "direct", "supervise", "own", "drive", "steer"]],
  ["train", ["train", "coach", "mentor", "teach", "onboard", "upskill"]],
  ["hire", ["hire", "recruit", "staff"]],
  ["build", ["build", "develop", "create", "design", "implement", "launch", "establish", "engineer", "architect"]],
  ["present", ["present", "report", "brief", "pitch"]],
  ["analyse", ["analyse", "analyze", "study", "review", "assess", "evaluate", "audit", "research"]],
  ["negotiate", ["negotiate", "close", "sign", "secure"]],
  ["advise", ["advise", "consult", "support", "assist"]],
] as const) {
  for (const v of verbs) VERB_GROUPS.set(lemma(v), group);
}
export const verbGroup = (verb: string | null): string | null => (verb ? (VERB_GROUPS.get(verb) ?? null) : null);

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

const isContent = (w: string) => !/\d/.test(w) && !STOP.has(w) && !DOWN.has(w) && !UP.has(w) && !TARGET.has(w) && !NEGATION.has(w) && !GENERIC_OBJECTS.has(w) && w.length > 1;

/** The claims a text makes, one per value found. */
export function claimsOf(text: string): Claim[] {
  const out: Claim[] = [];
  const norm = normaliseNumbers(text);
  for (const sentence of norm.split(/(?<=[.;:!?])\s+|\n/)) {
    const clauses = sentence.split(/,\s+(?=(?:and |but |which |while )?[a-z])/);
    // A segment with no words of its own, "or USD 9.2M a year" after "cut cost 11 percent", is an apposition: it measures what the segment before it measured.
    let inherited: string[] = [];
    const sentenceWords = [...new Set(sentence.split(/[^a-z0-9]+/).filter(isContent).map(singular))];
    const first = out.length;
    for (const clause of clauses.flatMap(segmentsOf)) {
      const words = clause.split(/[^a-z0-9]+/).filter(Boolean);
      const direction = words.some((w) => DOWN.has(w)) === words.some((w) => UP.has(w)) ? null : words.some((w) => DOWN.has(w)) ? "down" : "up";
      const matches = [...clause.matchAll(VALUE)];
      const content = (ws: string[]) => [...new Set(ws.filter(isContent).map(singular))];
      // A resume predicate opens with its verb: "Led a 3 year cost program", "Designed and ran". The verb says what the person did,
      // not what the value measures, so it is not a metric word; "Led" for "Ran" is a rewording. Kept when it is the only word,
      // "Revenue grew 20 percent" measures revenue. It is kept apart as the predicate's verb, a relationship the claim carries.
      const all = content(words);
      const lead = words.find((w) => !/\d/.test(w));
      const metricWords = lead && all[0] === singular(lead) && all.length > 1 ? all.slice(1) : all;
      const verb = lead && /^[a-z]+$/.test(lead) && !STOP.has(lead) ? lemma(lead) : null;
      const read = matches.map((m) => {
        const g = m.groups ?? {};
        let kind: ClaimKind;
        let value: number | string;
        let unit: string | null = null;
        let key: string;
        const nounWords: string[] = [];
        // A sign the normaliser kept: "-11 percent" is not 11 percent.
        const at = m.index!;
        const negative = at > 0 && clause[at - 1] === "-" && !/[a-z0-9]/.test(clause[at - 2] ?? "");
        const signed = (n: number) => (negative ? -n : n);
        if (g.cur || g.mcur) {
          kind = "money";
          value = signed(Number(g.curn ?? g.mn));
          unit = CURRENCIES.get(g.cur ?? g.mcur) ?? null;
          key = `money:${unit}:${fmt(value)}`;
        } else if (g.pn) {
          kind = "pct";
          value = signed(Number(g.pn));
          key = `pct:${fmt(value)}`;
        } else if (g.per) {
          kind = "period";
          unit = PERIODS.get(g.per.split(" ").pop()!) ?? null;
          const f = g.freq;
          const times = f === undefined ? 1 : (FREQUENCIES.get(f) ?? Number(/\d+/.exec(f)?.[0] ?? 1));
          value = times === 1 ? String(unit) : `${times}x${unit}`;
          key = `period:${value}`;
        } else if (g.mon) {
          const month = MONTHS.get(g.mon);
          if (month === undefined) {
            // "since 2023" style words are not months; read the year on its own.
            kind = "year";
            value = g.my;
            key = `year:${g.my}`;
          } else {
            kind = "date";
            value = `${g.my}-${month}`;
            key = `date:${value}`;
          }
        } else if (g.dy) {
          kind = "date";
          value = `${g.dy}-${g.dm}`;
          key = `date:${value}`;
        } else if (g.y || g.yp) {
          kind = "year";
          value = g.y ?? g.yp;
          key = `year:${value}`;
        } else if (g.dn) {
          kind = "duration";
          value = signed(Number(g.dn));
          unit = TIME_UNITS.get(g.du) ?? singular(g.du);
          key = `num:${fmt(value)}`;
        } else {
          kind = "count";
          value = signed(Number(g.n));
          // The counted noun is the head of the run after the number: "4 strategy managers" counts managers, "38 teams" teams.
          const run = /^\s*(?:of\s+)?((?:[a-z][a-z-]*\s+){0,4}[a-z][a-z-]*)/.exec(clause.slice(at + m[0].length));
          for (const w of (run?.[1] ?? "").split(/\s+/)) {
            if (!w || STOP.has(w) || DOWN.has(w) || UP.has(w) || PRE_TARGET.has(w) || NEGATION.has(w) || /\d/.test(w)) break;
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
        // "by 11 percent" is a change, "to 11 percent" a level; the word right before the value, hedges skipped, says which.
        const beforeValue = [...before].reverse().find((w) => !HEDGES.has(w));
        const relation: ClaimRelation | null = kind === "period" || kind === "date" || kind === "year" ? null : beforeValue === "by" ? "by" : beforeValue === "to" || beforeValue === "at" ? "to" : null;
        // "did not manage 6 analysts": a denial anywhere before the value in its predicate.
        const negated = clause.slice(0, m.index!).split(/[^a-z]+/).some((w) => NEGATION.has(w));
        const nounRun = nounWords.map(singular);
        const own = new Set([...nounRun, ...(unit ? [unit] : [])]);
        const segmentMetric = metricWords.filter((w) => !own.has(w));
        const metric = segmentMetric.length ? segmentMetric : inherited.filter((w) => !own.has(w));
        out.push({ key, kind, value, unit, nounRun, metric, sentence: sentenceWords, others: [], verb, relation, negated, role, direction: kind === "date" || kind === "year" || kind === "period" ? null : direction, clause: clause.trim() });
      });
      const ownWords = new Set(read.flatMap((r) => [...r.nounWords.map(singular), ...(r.unit ? [r.unit] : [])]));
      const segmentWords = metricWords.filter((w) => !ownWords.has(w));
      if (segmentWords.length) inherited = segmentWords;
    }
    // What the sentence lends a value is its words less the other values' own measures: "reduced churn 11 percent, and cut acquisition
    // cost 5 percent" lends "churn" to 11 and "acquisition cost" to 5, not the other way round.
    const mine = out.slice(first);
    for (const c of mine) {
      const own = new Set([...c.metric, ...c.nounRun, ...(c.unit ? [c.unit] : [])]);
      c.others = [...new Set(mine.filter((o) => o !== c && o.key !== c.key).flatMap((o) => o.metric).filter((w) => !own.has(w)))];
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
 * or null when it does. Kind, unit, role, direction, relation and negation
 * are mechanical: a percentage that became a count, months that became
 * years, a target that became a result, a fall that became a rise, a change
 * that became a level, a denial that became an assertion. Each is a
 * contradiction the model can fix from the finding, so each is hard.
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
  if (fact.relation && line.relation && fact.relation !== line.relation) return fact.relation === "by" ? `a change of ${describe(fact)} became a level of ${describe(line)}` : `a level of ${describe(fact)} became a change of ${describe(line)}`;
  if (fact.negated !== line.negated) return fact.negated ? "a denial became an assertion" : "an assertion became a denial";
  return null;
}

/** "11 percent", "USD 9200000", "12 months", "11 teams", "a count", "2023-01", "per year", "2 times per year". */
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
    case "period": {
      const [times, unit] = String(c.value).includes("x") ? String(c.value).split("x") : ["1", String(c.value)];
      return times === "1" ? `per ${unit}` : `${times} times per ${unit}`;
    }
    default:
      return String(c.value);
  }
}

/**
 * Whether the two sides measure the same thing, as far as words can tell:
 * yes when every metric word of the line's predicate is in the fact's
 * side, unreadable when either side has none to compare, differ
 * otherwise. One shared word is not agreement: "customer churn" and
 * "customer acquisition costs" share a word and measure different things.
 * The line's side is its own predicate, so a value cannot borrow words
 * from elsewhere in the line. The fact's side is its whole sentence, so a
 * line that folds the fact's descriptive clauses into one predicate still
 * passes, with one exception: a line whose metric words are a sibling
 * value's own measure and none of this value's has paired the value with
 * the wrong measure, "reduced churn 11 percent, and cut acquisition cost 5
 * percent" as "reduced acquisition cost 11 percent" (review four, 3A).
 * Verbs from different groups differ before any word is compared. Dates
 * and years are exempt; their meaning is the value and the role. A period
 * is not: "annually" from "reviewed budgets annually" does not annualise
 * "cut costs by 11 percent".
 */
export function metricsAgree(fact: Claim, line: Claim): "yes" | "differ" | "unreadable" {
  if (fact.kind === "date" || fact.kind === "year") return "yes";
  const fg = verbGroup(fact.verb);
  const lg = verbGroup(line.verb);
  if (fg && lg && fg !== lg) return "differ";
  const factSide = new Set(fact.sentence.map(lemma));
  // A value's own words are its predicate's measure and its counted noun: "11 regional units" owns "regional" and "unit".
  const own = new Set([...fact.metric, ...fact.nounRun, ...(fact.unit ? [fact.unit] : [])].map(lemma));
  const siblings = new Set(fact.others.map(lemma));
  // The line's words for this value are its predicate's measure and its own counted noun, so "38 teams" folded into the fact's next clause keeps its noun.
  const lineWords = [...line.metric, ...line.nounRun, ...(line.unit ? [line.unit] : [])].map(lemma);
  if (lineWords.length && own.size && lineWords.some((w) => siblings.has(w)) && !lineWords.some((w) => own.has(w))) return "differ";
  // "6 analysts" against "6 analysts": the counted noun is the metric, and it matched already.
  if (fact.kind === "count" || line.kind === "count") {
    const factNouns = [...fact.nounRun, ...(fact.unit ? [fact.unit] : [])].map(lemma);
    const lineNouns = [...line.nounRun, ...(line.unit ? [line.unit] : [])].map(lemma);
    const lineMetric = new Set(line.metric.map(lemma));
    const factMetric = new Set(fact.metric.map(lemma));
    // "team of 6" against "6 team members": the noun on one side is a metric word or the noun on the other.
    if (factNouns.some((w) => lineNouns.includes(w) || lineMetric.has(w)) || lineNouns.some((w) => factMetric.has(w))) return "yes";
  }
  if (!fact.metric.length || !line.metric.length) return "unreadable";
  // A period's predicate is the whole activity, which a rewording adds words to, so a period is bound by sharing a measure word with the fact's
  // period sentence rather than by every word: "present measurable plans to the board twice a year" shares "board"; "cut costs by 11 percent
  // annually" shares nothing with "reviewed budgets annually" (review four, 4B).
  if (fact.kind === "period") return lineMetricLemmasShare(line, factSide) ? "yes" : "differ";
  return line.metric.every((w) => factSide.has(lemma(w))) ? "yes" : "differ";
}

const lineMetricLemmasShare = (line: Claim, factSide: Set<string>) => line.metric.some((w) => factSide.has(lemma(w)));
