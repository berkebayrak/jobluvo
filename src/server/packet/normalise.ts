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
 * thousand two million" or "twenty ten", is left as its words and reported,
 * so the validator can hold the line rather than pass a value it never saw.
 *
 * Review four, finding 7: a tens word takes a units word under ten only,
 * digits before "hundred" scale like digits before "thousand", every
 * thousands separator is dropped however many there are, and a minus sign
 * before a digit is part of the number, not a hyphen to open.
 *
 * The sixth review, item 3, second case: a comma between digits that is not a
 * thousands separator was read silently and wrongly. "USD 9,2 million" came
 * out as USD 9 and a separate 2000000, so a truthful line saying "USD 9.2
 * million" matched nothing on the profile and was rejected as a fabricated
 * figure. Whether that comma is a decimal point or a typed separator cannot be
 * told from the text, and guessing either way invents a value the user did not
 * write, so the phrase is reported as unreadable and the caller holds the line
 * instead of rejecting it (D-040).
 *
 * The seventh review, finding 4: reporting the span and then reading values out
 * of it anyway is worse than either alone. "USD 9,2 million" was marked
 * unreadable and still yielded USD 9 and 2000000, two figures nobody wrote,
 * which then stood as confirmed evidence on the fact side and as fabrications
 * on the line side. `unreadableSpans` says where in `text` each such phrase
 * sits, and `claimsOf` emits nothing that overlaps one. Numbers elsewhere in
 * the same text are untouched: one bad span does not silence a fact (D-046).
 *
 * The eighth review, finding 5, and the limit is worth knowing before trusting
 * this. **The spans are rediscovered from the rewritten text, not carried
 * through the rewrite.** Every pass below can move or consume the characters a
 * span covered, so finding it again afterwards is a second heuristic on top of
 * the first. One case where that failed is closed here and tested, and the
 * class is not closed: carrying offsets through the separator strip, the
 * hyphen rules, the suffix expansion and the tokeniser is a rewrite of this
 * function rather than a patch, and it is placed in phase 1 (D-053).
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
  /** Number phrases the grammar could not read, worded as a person would read them back. */
  unreadable: string[];
  /**
   * Where those phrases sit in `text`, as half open character ranges. A value
   * that overlaps one is not a value: the span could not be read, so nothing
   * taken out of it is evidence of anything (D-046). The ranges are in the
   * coordinates of `text`, not of the input, and they are what `claimsOf`
   * filters on.
   */
  unreadableSpans: [number, number][];
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
  let t = text.toLowerCase().replace(/[–—]/g, " ");
  // Thousands separators, however many groups: a comma between digits goes when only whole groups of three follow it, "1,234,567,890,123" and never "1,2345".
  t = t.replace(/(?<=\d),(?=\d{3}(?:,\d{3})*(?!\d))/g, "");
  // Whatever commas are left between digits were not separators. The scale word after one is taken with it, so the
  // phrase reads as it was written: "9,2 million", not "9,2". Nothing below tries to give it a value.
  // Longest scale word first, so the phrase is reported as it was written: "9,2 million", not "9,2 m". This is the
  // wording a person reads; where it lands in the output is worked out at the end, because the pipeline below
  // rewrites the text around it.
  const commas = [...t.matchAll(/\d+(?:,\d+)+(?:\s?(?:million|billion|thousand|mn|bn|k|m|b))?/g)].map((m) => m[0]);
  // A hyphen before a digit that follows nothing alphanumeric is a sign, "-11 percent", and stays. Every other hyphen carries no value:
  // "3-year", "three-year", "two-thirds", "2019-2023" all open up. The one in a YYYY-MM date stays.
  t = t.replace(/(^|[^a-z0-9)])-(?=\d)/g, "$1\u2212");
  t = t.replace(/-(?!(?:0[1-9]|1[0-2])(?![\d.]))/g, " ");
  t = t.replace(/\u2212/g, "-");
  t = t.replace(/(\d+(?:\.\d+)?)\s?(k|m|mn|b|bn|million|billion|thousand)\b/g, (_, n: string, s: string) => fmt(Number(n) * SCALES[s]));
  t = t.replace(/(\d+)(st|nd|rd|th)\b/g, "$1");
  // "team of six." is a number followed by a full stop, not a word the tables do not know.
  t = t.replace(/([a-z])([.;:!?)])/g, "$1 $2");
  const words = t.split(/(\s+|[^a-z0-9.%$€£-])/);
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
    if (/^-\d/.test(w)) {
      // A signed digit token: a number of its own, never composed with a word before it.
      flush();
      out.push(w);
      continue;
    }
    const unit = UNITS.get(w);
    const tens = TENS.get(w);
    const big = BIG.get(w);
    if (unit !== undefined) {
      // A units word joins a tens word, a hundred, a scale, or the "and" after those. After anything else it is a new number.
      if (!(last === "tens" || last === "hundred" || last === "scale" || last === "and")) flush();
      // "twenty ten" is no number: a tens word takes a units word under ten only.
      if (last === "tens" && unit >= 10) bad = true;
      group = (group ?? 0) + unit;
      last = "unit";
      take(w);
    } else if (tens !== undefined) {
      if (!(last === "hundred" || last === "scale" || last === "and")) flush();
      group = (group ?? 0) + tens;
      last = "tens";
      take(w);
    } else if (w === "hundred") {
      // "two hundred", "a hundred", "twenty hundred", and "2 hundred" with the digits before it as the group. After a hundred or a scale word it reads nothing.
      if (!open()) {
        const i = lastToken();
        if (i >= 0 && /^\d+(\.\d+)?$/.test(out[i])) {
          group = Number(out[i]);
          out.splice(i);
        }
      }
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
  const output = out.join("").replace(/\s+/g, " ").trim();
  // Where each unreadable phrase sits in the text that comes out, so a caller can refuse to read values out of it.
  // A word number phrase survives the pipeline as its own words, so it is found by looking for it. A comma run does
  // not survive as it was written, because the scale word after it is expanded, but the comma itself is still there
  // and the run around it is the span: "9,2 million" leaves "9,2000000", and that whole token is the span (D-046).
  const spans: [number, number][] = [
    ...output.matchAll(/\d+(?:,\d+)+/g),
    // The digits after an ambiguous comma do not always survive: in "9,2 hundred hundred" the word machinery takes
    // the 2 and leaves "9,hundred", so the run above finds nothing and "usd 9" reads as a value nobody wrote. A
    // digit and a comma with a non space immediately after it is that wreckage. The space matters: "4, 5 and 6" is
    // punctuation between two numbers and must keep both of them (D-053).
    ...output.matchAll(/\d+,(?=[^\s\d])/g),
  ].map((m) => [m.index!, m.index! + m[0].length] as [number, number]);
  for (const phrase of unreadable) {
    for (let i = output.indexOf(phrase); i >= 0; i = output.indexOf(phrase, i + phrase.length)) spans.push([i, i + phrase.length]);
  }
  return { text: output, unreadable: [...commas, ...unreadable], unreadableSpans: spans };
}
