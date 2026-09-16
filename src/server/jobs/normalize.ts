import { createHash } from "node:crypto";
import type { JobLocation } from "@/db/schema";
import type { RawPosting } from "@/server/sources/types";

/*
 * Pure functions that turn a RawPosting into the canonical job fields. No
 * database, no network, so every rule here has a unit test.
 */

const ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
  rsquo: "’",
  lsquo: "‘",
  rdquo: "”",
  ldquo: "“",
  mdash: "—",
  ndash: "–",
  hellip: "…",
};

/** Decodes HTML entities, including the double encoded content Greenhouse returns. */
export function decodeEntities(s: string): string {
  return s
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&([a-z]+);/gi, (m, name) => ENTITIES[name.toLowerCase()] ?? m);
}

/** Strips tags to plain text with paragraph breaks preserved as blank lines. */
export function htmlToText(html: string): string {
  let s = decodeEntities(html);
  if (/&lt;|&gt;|&amp;/.test(s)) s = decodeEntities(s);
  s = s
    .replace(/<\s*(script|style)[^>]*>[\s\S]*?<\s*\/\s*\1\s*>/gi, " ")
    .replace(/<\s*br\s*\/?>/gi, "\n")
    .replace(/<\s*\/\s*(p|div|li|h[1-6]|tr|ul|ol|section|article|blockquote)\s*>/gi, "\n\n")
    .replace(/<\s*li[^>]*>/gi, "- ")
    .replace(/<[^>]+>/g, " ");
  return normaliseWhitespace(s);
}

export function normaliseWhitespace(s: string): string {
  return s
    .replace(/ /g, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/**
 * Lowercase, punctuation and whitespace collapsed, level words kept. "Sr.
 * Product Manager, Growth (Remote)" and "Sr Product Manager Growth Remote"
 * meet here; "Senior Product Manager" does not, which is what the URL and
 * requisition rules are for.
 */
export function titleNorm(title: string): string {
  return title
    .toLowerCase()
    .replace(/[‐-―]/g, "-")
    .replace(/[^a-z0-9+#./\s-]/g, " ")
    .replace(/[./-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const US_STATES = new Set(
  "al ak az ar ca co ct de fl ga hi id il in ia ks ky la me md ma mi mn ms mo mt ne nv nh nj nm ny nc nd oh ok or pa ri sc sd tn tx ut vt va wa wv wi wy dc".split(
    " ",
  ),
);
const US_WORDS = /\b(united states|usa|u\.s\.a?\.?|us)\b/i;
const COUNTRY_CODES: Record<string, string> = {
  us: "US",
  usa: "US",
  "united states": "US",
  gb: "GB",
  uk: "GB",
  "united kingdom": "GB",
  ca: "CA",
  canada: "CA",
  de: "DE",
  germany: "DE",
  fr: "FR",
  france: "FR",
  ie: "IE",
  ireland: "IE",
  nl: "NL",
  netherlands: "NL",
  se: "SE",
  sweden: "SE",
  es: "ES",
  spain: "ES",
  in: "IN",
  india: "IN",
  au: "AU",
  australia: "AU",
  sg: "SG",
  singapore: "SG",
  br: "BR",
  brazil: "BR",
  jp: "JP",
  japan: "JP",
  pl: "PL",
  poland: "PL",
};

/**
 * Best effort parse of the free text location strings the boards hand out.
 * "New York, NY", "Remote - US", "London, United Kingdom", "San Francisco, CA
 * (HQ)" and "Remote" all come through. Whatever cannot be read stays in `raw`
 * with nothing invented.
 */
export function parseLocation(raw: string, hint?: { country?: string; remote?: boolean }): JobLocation {
  const loc: JobLocation = { raw: raw.trim() };
  const text = raw.replace(/\((hq|headquarters)\)/i, "").trim();
  if (/\bremote\b|\bwork from home\b|\bwfh\b|\bdistributed\b/i.test(text) || hint?.remote) loc.remote = true;
  const parts = text
    .split(/[,|/–—-]/)
    .map((p) => p.trim())
    .filter((p) => p && !/^remote$/i.test(p));
  for (const p of parts) {
    const key = p.toLowerCase();
    // "San Francisco, CA" is California, not Canada: a two letter US state
    // code after a city wins over the country table. "CA" on its own or
    // "Canada" spelled out still reads as the country.
    if (US_STATES.has(key) && key.length === 2 && loc.city) {
      loc.region = key.toUpperCase();
      loc.country = "US";
      continue;
    }
    if (COUNTRY_CODES[key]) {
      loc.country = COUNTRY_CODES[key];
      continue;
    }
    if (!loc.city && !/^\d/.test(p)) loc.city = p;
  }
  if (!loc.country && US_WORDS.test(text)) loc.country = "US";
  if (!loc.country && hint?.country) {
    const c = COUNTRY_CODES[hint.country.toLowerCase()] ?? hint.country.toUpperCase();
    if (c.length === 2) loc.country = c;
  }
  return loc;
}

export function parseLocations(raws: string[], hint?: { country?: string; remote?: boolean }): JobLocation[] {
  const seen = new Set<string>();
  const out: JobLocation[] = [];
  for (const r of raws) {
    if (!r || seen.has(r)) continue;
    seen.add(r);
    out.push(parseLocation(r, hint));
  }
  return out;
}

export type Workplace = "remote" | "hybrid" | "onsite" | "unknown";

export function workplaceOf(p: RawPosting, locations: JobLocation[]): Workplace {
  if (p.workplace) return p.workplace;
  if (p.remote === true) return "remote";
  if (locations.some((l) => l.remote)) return "remote";
  if (p.remote === false) return "onsite";
  return "unknown";
}

export function employmentTypeOf(v: string | undefined): string | undefined {
  if (!v) return undefined;
  const k = v.toLowerCase().replace(/[^a-z]/g, "");
  if (/fulltime|permanent|regular/.test(k)) return "Full time";
  if (/parttime/.test(k)) return "Part time";
  if (/intern/.test(k)) return "Internship";
  if (/contract|temporary|fixedterm|freelance/.test(k)) return "Contract";
  return v;
}

export interface Compensation {
  min?: number;
  max?: number;
  currency?: string;
  period: "year" | "hour" | "unknown";
}

/** Reads "$211.4K – $290.6K", "USD 150,000 - 175,000", "$45/hr" and the like. */
export function parseCompensation(s: string | undefined): Compensation | undefined {
  if (!s) return undefined;
  const text = s.replace(/–|—/g, "-");
  const nums = [...text.matchAll(/(?:\$|usd|eur|gbp|€|£)?\s*(\d{1,3}(?:[,.]\d{3})+|\d+(?:\.\d+)?)\s*(k|m)?\b/gi)];
  const values = nums
    .map((m) => {
      let n = Number(m[1].replace(/,/g, ""));
      if (m[2]?.toLowerCase() === "k") n *= 1_000;
      if (m[2]?.toLowerCase() === "m") n *= 1_000_000;
      return n;
    })
    .filter((n) => n >= 10 && n < 5_000_000);
  if (!values.length) return undefined;
  const currency = /€|\beur\b/i.test(text) ? "EUR" : /£|\bgbp\b/i.test(text) ? "GBP" : /\$|\busd\b/i.test(text) ? "USD" : undefined;
  const period: Compensation["period"] = /\/\s*(hr|hour)|per hour|hourly/i.test(text)
    ? "hour"
    : /year|annual|\/\s*yr|k\b/i.test(text) || values[0] > 5_000
      ? "year"
      : "unknown";
  return { min: Math.min(...values), max: Math.max(...values), currency, period };
}

export type Sponsorship = "offered" | "not_offered" | "unknown";

/** Only what the posting says, with the sentence kept as evidence. */
export function sponsorshipOf(text: string): { value: Sponsorship; evidence?: string } {
  const sentences = text.split(/(?<=[.!?])\s+|\n+/);
  const hit = sentences.find((s) => /\b(sponsor|sponsorship|visa|h-?1b|work authori[sz]ation)\b/i.test(s));
  if (!hit) return { value: "unknown" };
  const neg =
    /\b(not|unable|cannot|can't|won't|will not|no)\b[^.]*\b(sponsor|sponsorship)\b|\b(sponsor|sponsorship)\b[^.]*\b(is not|not available|unavailable)\b|must be authori[sz]ed[^.]*without/i;
  if (neg.test(hit)) return { value: "not_offered", evidence: hit.trim().slice(0, 300) };
  if (/\b(will|can|able to|offers?|provide)\b[^.]*\bsponsor/i.test(hit)) {
    return { value: "offered", evidence: hit.trim().slice(0, 300) };
  }
  return { value: "unknown", evidence: hit.trim().slice(0, 300) };
}

const SENIORITY: [RegExp, string][] = [
  [/\b(intern|internship)\b/i, "Intern"],
  [/\b(vp|vice president)\b/i, "VP"],
  [/\b(chief|cto|cfo|coo|ceo)\b/i, "Executive"],
  [/\b(head of)\b/i, "Head"],
  [/\b(director)\b/i, "Director"],
  [/\b(principal|distinguished|fellow)\b/i, "Principal"],
  [/\b(staff)\b/i, "Staff"],
  [/\b(senior manager)\b/i, "Senior manager"],
  [/\b(manager)\b/i, "Manager"],
  [/\b(lead)\b/i, "Lead"],
  [/\b(senior|sr\.?)\b/i, "Senior"],
  [/\b(junior|jr\.?|associate|entry|graduate|new grad)\b/i, "Junior"],
];

export function seniorityOf(title: string): string | undefined {
  for (const [re, label] of SENIORITY) if (re.test(title)) return label;
  return undefined;
}

/*
 * Boilerplate. Paragraphs that repeat verbatim across two or more jobs of one
 * source, plus a fixed phrase list, are not part of the role and would
 * dominate any similarity measure. The detected set is stored on the source
 * with a version; description_core is always computed under a stated version.
 */
const FIXED_PHRASES = [
  /equal (opportunity|employment opportunity) employer/i,
  /without regard to (race|age|gender|sex)/i,
  /reasonable accommodation/i,
  /affirmative action/i,
  /e-verify/i,
  /background check/i,
  /\bbenefits (include|package)\b/i,
  /\b401\(?k\)?\b/i,
  /privacy (policy|notice)/i,
  /recruiting scams?/i,
];

export function paragraphsOf(text: string): string[] {
  return text
    .split(/\n\s*\n/)
    .map((p) => normaliseWhitespace(p))
    .filter((p) => p.length >= 40);
}

export function isFixedBoilerplate(p: string): boolean {
  return FIXED_PHRASES.some((re) => re.test(p));
}

/** Paragraphs that appear verbatim in two or more of the given texts. */
export function detectRepeated(texts: string[]): string[] {
  const counts = new Map<string, number>();
  for (const t of texts) {
    for (const p of new Set(paragraphsOf(t))) counts.set(p, (counts.get(p) ?? 0) + 1);
  }
  return [...counts.entries()].filter(([, n]) => n >= 2).map(([p]) => p);
}

export function descriptionCore(text: string, boilerplate: string[]): string {
  const bp = new Set(boilerplate);
  return paragraphsOf(text)
    .filter((p) => !bp.has(p) && !isFixedBoilerplate(p))
    .join("\n\n");
}

export function sha256(s: string): string {
  return createHash("sha256").update(s).digest("hex");
}

export function contentHash(title: string, locations: JobLocation[], core: string): string {
  const locs = locations
    .map((l) => l.raw.toLowerCase().trim())
    .sort()
    .join("|");
  return sha256(`${titleNorm(title)}\n${locs}\n${core}`);
}

export interface NormalisedJob {
  title: string;
  titleNorm: string;
  locations: JobLocation[];
  workplace: Workplace;
  employmentType?: string;
  comp?: Compensation;
  seniority?: string;
  sponsorship: Sponsorship;
  sponsorshipEvidence?: string;
  descriptionText: string;
  descriptionHtml: string;
  descriptionCore: string;
  contentHash: string;
}

export function normalise(p: RawPosting, boilerplate: string[]): NormalisedJob {
  const title = normaliseWhitespace(p.title);
  const descriptionHtml = p.descriptionHtml ?? "";
  const descriptionText = htmlToText(descriptionHtml);
  const locations = parseLocations(p.locations, { remote: p.remote });
  const core = descriptionCore(descriptionText, boilerplate);
  const sp = sponsorshipOf(descriptionText);
  return {
    title,
    titleNorm: titleNorm(title),
    locations,
    workplace: workplaceOf(p, locations),
    employmentType: employmentTypeOf(p.employmentType),
    comp: p.compensation
      ? { period: p.compensation.period ?? "unknown", ...p.compensation }
      : undefined,
    seniority: seniorityOf(title),
    sponsorship: sp.value,
    sponsorshipEvidence: sp.evidence,
    descriptionText,
    descriptionHtml,
    descriptionCore: core,
    contentHash: contentHash(title, locations, core),
  };
}
