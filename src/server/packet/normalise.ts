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
 * **How a span is known, which is the subject of reviews eight, nine and ten
 * and is settled here (D-065).** The position is carried, not recovered. A
 * comma phrase is lifted out of the text below while its position is still
 * known and a placeholder left in its place; a word number the grammar could
 * not read is recorded by `flush` at the index it writes to. One walk at the
 * end turns those indices into offsets. **Nothing searches the output.**
 *
 * That is worth stating as history rather than as a rule, because three
 * versions of this file tried to recover the position afterwards and each one
 * was a pattern that was right about its example and wrong about the class it
 * matched:
 *
 * - D-053 matched a digit, a comma and any non space, to find the wreckage an
 *   ambiguous comma leaves. It matched every comma in prose that was missing
 *   its space, suppressed the value and reported no phrase, so "in 2023,we
 *   launched" lost its year in silence and a later truthful line stating that
 *   year was rejected as a fabrication (the ninth review's finding 1, D-055).
 * - D-055 replaced it with a search by the phrase's leading digits. That
 *   suppressed every occurrence sharing those digits, so the readable year in
 *   "Ambiguous 2023,4; In 2023,we launched" went with the ambiguous run (the
 *   tenth review's item 2, D-063).
 * - D-063 narrowed the search to the occurrence and refused to guess between
 *   two that looked alike. That left a phrase it could not locate unmarked, so
 *   its fragments reached the claims as evidence nobody wrote.
 *
 * Each fix was smaller than the last and each introduced its own defect,
 * because the information they were all reconstructing had been thrown away a
 * few lines earlier. It is kept now.
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
   *
   * **Every range here is produced by a phrase in `unreadable`, at the
   * occurrence that phrase produced, and every such phrase has one. This is
   * true by construction and not by assertion**, which is the difference
   * between this version and the three before it (D-065).
   *
   * There are exactly two places a phrase enters the output, and each records
   * the index it is writing to at the moment it writes:
   *
   * - a word number the grammar could not read is pushed by `flush`, which adds
   *   the index it used to `marked` in the same breath;
   * - a comma phrase is lifted out of the text before any rewrite runs, while
   *   its position is still known, and a placeholder stands in its place. The
   *   placeholder cannot be touched by the passes between, arrives in the token
   *   loop as an element of its own, and is swapped back for the phrase, again
   *   recording the index.
   *
   * A single walk then turns those indices into character offsets by
   * accumulating the lengths it emits. Nothing searches the output for anything,
   * so there is no pattern here to be right about one case and wrong about a
   * class, which is how the three earlier versions failed.
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

/**
 * The character a phrase taken out of the text is wrapped in. The tokeniser
 * splits on it, so the placeholder between two of them is always an element of
 * its own. Stripped from the input first, so nothing in a resume can be
 * mistaken for one.
 */
const GUARD = "\u0001";

/** A number as letters, bijective base 26, so each placeholder is distinct and carries no digit. */
const letters = (n: number): string => (n < 26 ? String.fromCharCode(97 + n) : letters(Math.floor(n / 26) - 1) + String.fromCharCode(97 + (n % 26)));

/** `normaliseNumbers` with the phrases it could not read. */
export function readNumbers(text: string): NumberReading {
  let t = text.toLowerCase().replace(/[–—]/g, " ").split(GUARD).join(" ");
  // Thousands separators, however many groups: a comma between digits goes when only whole groups of three follow it, "1,234,567,890,123" and never "1,2345".
  t = t.replace(/(?<=\d),(?=\d{3}(?:,\d{3})*(?!\d))/g, "");
  // Whatever commas are left between digits were not separators. The scale word after one is taken with it, so the
  // phrase reads as it was written: "9,2 million", not "9,2". Nothing below tries to give it a value.
  // Longest scale word first, so the phrase is reported as it was written: "9,2 million", not "9,2 m". This is the
  // wording a person reads; where it lands in the output is worked out at the end, because the pipeline below
  // rewrites the text around it.
  const found = [...t.matchAll(/\d+(?:,\d+)+(?:\s?(?:million|billion|thousand|mn|bn|k|m|b))?/g)];
  const commas = found.map((m) => m[0]);
  /*
   * Each phrase is taken out of the text here, where its position is known, and a placeholder put in its place.
   * Nothing below ever looks for it again.
   *
   * The placeholder is lower case letters, so the tokeniser keeps it whole, and it carries no digit, no hyphen
   * and no suffix letter, so none of the passes between here and the loop can touch it. It is wrapped in a
   * character the tokeniser treats as a separator, which is what guarantees it arrives in `out` as an element of
   * its own rather than glued to the word beside it: "usd9,2million" would otherwise leave "usdPLACEHOLDER".
   * The prefix is grown until it appears nowhere in the text, so a resume that happens to contain it cannot
   * collide with it.
   */
  let mark = "qzx";
  while (t.includes(mark)) mark += "q";
  const placeholders = new Map<string, string>();
  // Backwards, so an earlier phrase's index is still valid when a later one has been replaced.
  for (let i = found.length - 1; i >= 0; i -= 1) {
    const m = found[i];
    const token = `${mark}${letters(i)}`;
    placeholders.set(token, m[0]);
    t = `${t.slice(0, m.index!)}${GUARD}${token}${GUARD}${t.slice(m.index! + m[0].length)}`;
  }
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
  /**
   * Which elements of `out` are an unreadable phrase, by their index in `out`.
   *
   * This is the whole of how a span is known. Both writers below record the
   * index they are writing to, at the moment they write it, so the offsets are
   * carried through the rest of the function rather than looked for afterwards.
   */
  const marked = new Set<number>();

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
        // Writer one. The index is recorded here, where it is known, and never searched for again.
        marked.add(out.length);
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
    // The guard characters are scaffolding and never reach the output. They need no flush of their own: the
    // placeholder they wrap does one, so a number open before them is closed in the right order.
    if (w === GUARD) continue;
    const held = placeholders.get(w);
    if (held !== undefined) {
      // Writer two. The phrase goes back in as it was written, at the position it was taken from, and the index
      // is recorded exactly as writer one records its own. Nothing in the loop reads it as a number.
      flush();
      marked.add(out.length);
      out.push(held);
      continue;
    }
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
  /*
   * The output string and the spans, built in one walk over `out`.
   *
   * Nothing is searched for here. Both writers above recorded the index in `out` they wrote an unreadable phrase
   * to, so this walk only has to turn those indices into character offsets, which it does by accumulating the
   * lengths it emits. The whitespace normalisation happens in the walk rather than as a `replace` over the joined
   * string, because a `replace` afterwards would move every offset this walk just worked out.
   *
   * A run of whitespace is held rather than emitted, and a single space is emitted before the next piece of text
   * instead. That collapses runs and drops the leading and trailing space in one rule, which is what the old
   * `.replace(/\s+/g, " ").trim()` did, and it keeps the offsets describing the string that is actually returned.
   */
  let output = "";
  let gap = false;
  const spans: [number, number][] = [];
  for (let i = 0; i < out.length; i += 1) {
    const piece = out[i];
    if (piece === GUARD) continue;
    let from = -1;
    for (const part of piece.split(/(\s+)/)) {
      if (!part) continue;
      if (/^\s+$/.test(part)) {
        if (output.length) gap = true;
        continue;
      }
      if (gap) {
        output += " ";
        gap = false;
      }
      if (from < 0) from = output.length;
      output += part;
    }
    if (marked.has(i) && from >= 0) spans.push([from, output.length]);
  }
  return { text: output, unreadable: [...commas, ...unreadable], unreadableSpans: spans };
}
