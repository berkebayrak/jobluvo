/*
 * The number normaliser both sides of the validator go through, so eight
 * and 8, USD 2.3M and 2.3 million, Jan 2023 and January 2023 compare
 * equal. When the validator fires on a legitimate rephrasing this is what
 * gets fixed. The rule is never loosened.
 */

const UNITS: Record<string, number> = {
  zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
  eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19,
};
const TENS: Record<string, number> = { twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60, seventy: 70, eighty: 80, ninety: 90 };
export const SCALES: Record<string, number> = { hundred: 100, thousand: 1_000, k: 1_000, million: 1_000_000, mn: 1_000_000, m: 1_000_000, billion: 1_000_000_000, bn: 1_000_000_000, b: 1_000_000_000 };

export const fmt = (n: number) => (Number.isInteger(n) ? String(n) : String(Number(n.toFixed(6))));

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
  // "team of six." is a number followed by a full stop, not a word the tables do not know.
  t = t.replace(/([a-z])([.;:!?)])/g, "$1 $2");
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
