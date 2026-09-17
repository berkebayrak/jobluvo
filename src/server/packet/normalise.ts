/*
 * The number normaliser both sides of the validator go through, so eight
 * and 8, USD 2.3M and 2.3 million, Jan 2023 and January 2023 compare
 * equal. When the validator fires on a legitimate rephrasing this is what
 * gets fixed. The rule is never loosened.
 *
 * A word number is composed only along the grammar of English numbers: a
 * tens word may take a units word ("twenty five"), "hundred" scales the
 * group before it and may take "and" then a tens or units word ("two
 * hundred and five"), and a scale word closes a group and may be followed
 * by a smaller scale's group ("two million five hundred thousand"). Two
 * number words that the grammar does not join are two numbers: "three and
 * five teams" is 3 and 5, never 8. A phrase the grammar cannot read, "five
 * thousand two million", is left as its words and reported, so the
 * validator can hold the line rather than pass a value it never saw.
 */

const UNITS = new Map<string, number>([
  ["zero", 0], ["one", 1], ["two", 2], ["three", 3], ["four", 4], ["five", 5], ["six", 6], ["seven", 7], ["eight", 8], ["nine", 9], ["ten", 10],
  ["eleven", 11], ["twelve", 12], ["thirteen", 13], ["fourteen", 14], ["fifteen", 15], ["sixteen", 16], ["seventeen", 17], ["eighteen", 18], ["nineteen", 19],
]);
const TENS = new Map<string, number>([["twenty", 20], ["thirty", 30], ["forty", 40], ["fifty", 50], ["sixty", 60], ["seventy", 70], ["eighty", 80], ["ninety", 90]]);
export const SCALES: Record<string, number> = { hundred: 100, thousand: 1_000, k: 1_000, million: 1_000_000, mn: 1_000_000, m: 1_000_000, billion: 1_000_000_000, bn: 1_000_000_000, b: 1_000_000_000 };
const BIG = new Map<string, number>([["thousand", 1_000], ["million", 1_000_000], ["billion", 1_000_000_000]]);

export const fmt = (n: number) => {
  if (typeof n !== "number" || !Number.isFinite(n)) throw new TypeError(`fmt: not a number: ${String(n)}`);
  return Number.isInteger(n) ? String(n) : String(Number(n.toFixed(6)));
};

export interface NumberReading {
  /** The text with every readable number in digits. */
  text: string;
  /** Number phrases the grammar could not read, left as their words in `text`. */
  unreadable: string[];
}

/**
 * Text with every number written in digits: word numbers composed
 * ("twenty five" 25, "two million" 2000000), suffixes expanded ("9.2M"
 * 9200000, "400k" 400000), thousands separators dropped, hyphens between a
 * number and a word opened ("3-year" "3 year"). Lower case.
 */
export function normaliseNumbers(text: string): string {
  return readNumbers(text).text;
}

type Last = "unit" | "tens" | "hundred" | "scale" | "and";

/** `normaliseNumbers` with the phrases it could not read. */
export function readNumbers(text: string): NumberReading {
  let t = text.toLowerCase().replace(/[–—]/g, " ").replace(/(\d),(\d{3})(?!\d)/g, "$1$2").replace(/(\d),(\d{3})(?!\d)/g, "$1$2");
  // A hyphen carries no value: "3-year", "three-year", "two-thirds" all open up. The one in a YYYY-MM date stays.
  t = t.replace(/-(?!(?:0[1-9]|1[0-2])(?![\d.]))/g, " ");
  t = t.replace(/(\d+(?:\.\d+)?)\s?(k|m|mn|b|bn|million|billion|thousand)\b/g, (_, n: string, s: string) => fmt(Number(n) * SCALES[s]));
  t = t.replace(/(\d+)(st|nd|rd|th)\b/g, "$1");
  // "team of six." is a number followed by a full stop, not a word the tables do not know.
  t = t.replace(/([a-z])([.;:!?)])/g, "$1 $2");
  const words = t.split(/(\s+|[^a-z0-9.%$€£])/);
  const out: string[] = [];
  const unreadable: string[] = [];

  // The number being read: `group` is the part under the last scale word, `total` the scaled parts before it.
  let group: number | null = null;
  let total: number | null = null;
  let last: Last | null = null;
  let lastScale = Infinity;
  let phrase: string[] = [];
  let bad = false;
  let pendingAnd = false;
  let pendingSpace = false;
  const open = () => group !== null || total !== null;
  const lastToken = () => {
    let i = out.length - 1;
    while (i >= 0 && /^\s*$/.test(out[i])) i -= 1;
    return i;
  };
  const flush = () => {
    if (open()) {
      if (bad) {
        unreadable.push(phrase.join(" "));
        out.push(phrase.join(" "));
      } else out.push(fmt((total ?? 0) + (group ?? 0)));
      if (pendingAnd) out.push(" and");
      // The space swallowed while the number was open goes after it: "five three" is two numbers a space apart.
      if (pendingSpace) out.push(" ");
      pendingSpace = false;
    }
    group = null;
    total = null;
    last = null;
    lastScale = Infinity;
    phrase = [];
    bad = false;
    pendingAnd = false;
  };
  const take = (w: string) => {
    phrase.push(w);
    pendingAnd = false;
  };

  for (const w of words) {
    if (w === "") continue;
    if (/^\s+$/.test(w)) {
      if (!open()) out.push(w);
      else pendingSpace = true;
      continue;
    }
    const unit = UNITS.get(w);
    const tens = TENS.get(w);
    const big = BIG.get(w);
    if (unit !== undefined) {
      // A units word joins a tens word, a hundred, a scale, or the "and" after those. After anything else it is a new number.
      if (!(last === "tens" || last === "hundred" || last === "scale" || last === "and")) flush();
      group = (group ?? 0) + unit;
      last = "unit";
      take(w);
    } else if (tens !== undefined) {
      if (!(last === "hundred" || last === "scale" || last === "and")) flush();
      group = (group ?? 0) + tens;
      last = "tens";
      take(w);
    } else if (w === "hundred") {
      // "two hundred", "a hundred", "twenty hundred". After a hundred or a scale word it reads nothing.
      if (last === "hundred" || last === "scale" || last === "and") bad = true;
      group = (group ?? 1) * 100;
      last = "hundred";
      take(w);
    } else if (big !== undefined) {
      if (!open()) {
        // "2 million" survives the suffix pass only when a separator kept them apart; the digits before it are the group.
        const i = lastToken();
        if (i >= 0 && /^\d+(\.\d+)?$/.test(out[i])) {
          group = Number(out[i]);
          out.splice(i);
        }
      }
      // Scales must fall and carry a group: "two million five hundred thousand". "five thousand two million" and "two million thousand" read nothing.
      if (big >= lastScale || last === "scale" || last === "and") bad = true;
      total = (total ?? 0) + (group ?? 1) * big;
      group = null;
      lastScale = big;
      last = "scale";
      take(w);
    } else if (w === "and" && (last === "hundred" || last === "scale")) {
      // "two hundred and five": part of the number if a number word follows, otherwise the word "and" after it.
      last = "and";
      pendingAnd = true;
      phrase.push(w);
    } else {
      if (pendingAnd) phrase.pop();
      flush();
      out.push(w);
    }
  }
  if (pendingAnd) phrase.pop();
  flush();
  return { text: out.join("").replace(/\s+/g, " ").trim(), unreadable };
}
