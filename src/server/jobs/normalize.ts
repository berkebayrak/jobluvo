import { createHash } from "node:crypto";
import type { JobLocation } from "@/db/schema";
import type { RawLocation, RawPosting } from "@/server/sources/types";

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
const US_WORDS = /^(?:the\s+)?(united states(?: of america)?|usa|u\.s\.a?\.?|us)$/i;
/** Country names as boards write them, to ISO 3166 alpha 2. A name not here is kept as `countryName`, never guessed. */
const COUNTRY_CODES: Record<string, string> = {
  us: "US", usa: "US", "united states": "US", "united states of america": "US",
  gb: "GB", uk: "GB", "united kingdom": "GB", england: "GB", scotland: "GB", wales: "GB",
  ca: "CA", canada: "CA",
  de: "DE", germany: "DE",
  fr: "FR", france: "FR",
  ie: "IE", ireland: "IE",
  nl: "NL", netherlands: "NL", "the netherlands": "NL",
  se: "SE", sweden: "SE",
  es: "ES", spain: "ES",
  in: "IN", india: "IN",
  au: "AU", australia: "AU",
  sg: "SG", singapore: "SG",
  br: "BR", brazil: "BR",
  jp: "JP", japan: "JP",
  pl: "PL", poland: "PL",
  mx: "MX", mexico: "MX",
  kr: "KR", "south korea": "KR", korea: "KR",
  il: "IL", israel: "IL",
  cn: "CN", china: "CN",
  ch: "CH", switzerland: "CH",
  pt: "PT", portugal: "PT",
  ro: "RO", romania: "RO",
  it: "IT", italy: "IT",
  be: "BE", belgium: "BE",
  dk: "DK", denmark: "DK",
  no: "NO", norway: "NO",
  fi: "FI", finland: "FI",
  at: "AT", austria: "AT",
  cz: "CZ", czechia: "CZ", "czech republic": "CZ",
  hu: "HU", hungary: "HU",
  tr: "TR", turkey: "TR", "türkiye": "TR",
  ae: "AE", "united arab emirates": "AE", uae: "AE",
  sa: "SA", "saudi arabia": "SA",
  za: "ZA", "south africa": "ZA",
  ng: "NG", nigeria: "NG",
  ke: "KE", kenya: "KE",
  eg: "EG", egypt: "EG",
  ar: "AR", argentina: "AR",
  cl: "CL", chile: "CL",
  co: "CO", colombia: "CO",
  pe: "PE", peru: "PE",
  nz: "NZ", "new zealand": "NZ",
  ph: "PH", philippines: "PH",
  id: "ID", indonesia: "ID",
  vn: "VN", vietnam: "VN",
  th: "TH", thailand: "TH",
  my: "MY", malaysia: "MY",
  tw: "TW", taiwan: "TW",
  hk: "HK", "hong kong": "HK",
};
const US_STATE_NAMES: Record<string, string> = {
  alabama: "AL", alaska: "AK", arizona: "AZ", arkansas: "AR", california: "CA", colorado: "CO", connecticut: "CT",
  delaware: "DE", florida: "FL", georgia: "GA", hawaii: "HI", idaho: "ID", illinois: "IL", indiana: "IN", iowa: "IA",
  kansas: "KS", kentucky: "KY", louisiana: "LA", maine: "ME", maryland: "MD", massachusetts: "MA", michigan: "MI",
  minnesota: "MN", mississippi: "MS", missouri: "MO", montana: "MT", nebraska: "NE", nevada: "NV", "new hampshire": "NH",
  "new jersey": "NJ", "new mexico": "NM", "new york": "NY", "north carolina": "NC", "north dakota": "ND", ohio: "OH",
  oklahoma: "OK", oregon: "OR", pennsylvania: "PA", "rhode island": "RI", "south carolina": "SC", "south dakota": "SD",
  tennessee: "TN", texas: "TX", utah: "UT", vermont: "VT", virginia: "VA", washington: "WA", "west virginia": "WV",
  wisconsin: "WI", wyoming: "WY", "district of columbia": "DC",
};
/*
 * Cities that read as US on their own. Only names whose US reading is the
 * dominant one: no Cambridge, London, Richmond, Vancouver, Birmingham,
 * Manchester or Paris. A city not in this table keeps no country.
 */
const US_CITIES = new Set([
  "new york", "new york city", "nyc", "brooklyn", "manhattan", "jersey city", "san francisco", "sf", "los angeles",
  "san diego", "san jose", "oakland", "palo alto", "menlo park", "mountain view", "sunnyvale", "santa clara",
  "redwood city", "cupertino", "santa monica", "culver city", "irvine", "sacramento", "chicago", "seattle", "bellevue",
  "redmond", "boston", "austin", "denver", "boulder", "atlanta", "dallas", "houston", "phoenix", "philadelphia", "miami",
  "washington", "minneapolis", "detroit", "ann arbor", "nashville", "charlotte", "raleigh", "pittsburgh", "baltimore",
  "salt lake city", "las vegas", "columbus", "indianapolis", "kansas city", "st. louis", "st louis", "saint louis",
  "cincinnati", "cleveland", "milwaukee", "madison", "orlando", "tampa", "new orleans", "reston", "arlington",
  "portland", "san antonio", "fort worth", "tucson", "albuquerque", "omaha", "louisville", "memphis", "oklahoma city",
]);
const METRO = /^(?:greater\s+)?(.+?)\s+(?:bay\s+area|metropolitan\s+area|metro(?:politan)?\s+area|metro|area)$/i;
const NOT_A_PLACE = /^(n\/?a|tbd|tba|various|multiple(?: locations)?|flexible|global|worldwide|other|none|any|anywhere|nationwide|international)$/i;
const REMOTE_WORDS = /\b(remote|work from home|wfh|distributed|telecommute|home[- ]based)\b/i;

function canonicalCity(key: string): string | undefined {
  if (key === "nyc" || key === "new york city") return "New York";
  if (key === "sf") return "San Francisco";
  return undefined;
}

/**
 * Best effort parse of the free text location strings the boards hand out.
 * "New York, NY", "New York, New York", "St. Louis, Missouri", "Washington,
 * D.C.", "Greater Boston Area", "Remote - US", "US Remote", "Remote (United
 * States)", "Chicago" and "London, United Kingdom" all come through. Whatever
 * cannot be read stays in `raw` with nothing invented: "N/A" gets no city, and
 * a city outside the US table gets no country.
 */
export function parseLocation(raw: string, hint?: { country?: string; remote?: boolean }): JobLocation {
  const loc: JobLocation = { raw: raw.trim() };
  let text = raw.replace(/\((hq|headquarters)\)/i, "").trim();
  if (REMOTE_WORDS.test(text) || hint?.remote) loc.remote = true;
  if (NOT_A_PLACE.test(text)) return loc;
  text = text
    .replace(/\bd\.\s?c\.?(?=\W|$)/gi, "DC")
    .replace(/\bwashington\s+dc\b/i, "Washington, DC")
    .replace(/[()]/g, ",");
  const parts = text
    .split(/[,|/–—-]/)
    .map((p) =>
      p
        .replace(REMOTE_WORDS, " ")
        .replace(/\b(hybrid|on[- ]?site|based|only|eligible|friendly|option(?:al)?|first)\b/gi, " ")
        .replace(/^\s*(?:anywhere|any|all)?\s*(?:in|within|from|across)\b(?:\s+the)?\s*/i, "")
        .replace(/\s+/g, " ")
        .trim(),
    )
    .filter((p) => p && !/^the$/i.test(p));
  let cityIsUs = false;
  for (const p of parts) {
    const key = p.toLowerCase().replace(/\.$/, "");
    if (NOT_A_PLACE.test(key)) continue;
    if (US_WORDS.test(key)) {
      loc.country = "US";
      continue;
    }
    // "San Francisco, CA" is California, not Canada: a two letter US state
    // code after a city wins over the country table. "CA" on its own or
    // "Canada" spelled out still reads as the country.
    if (loc.city && key.length === 2 && US_STATES.has(key)) {
      loc.region = key.toUpperCase();
      loc.country = "US";
      continue;
    }
    if (COUNTRY_CODES[key]) {
      loc.country = COUNTRY_CODES[key];
      continue;
    }
    if (US_STATE_NAMES[key] && (loc.city || !US_CITIES.has(key))) {
      // "New York, New York" is a city then a state; "California" alone or
      // "Remote - Texas" is a state with no city. Both are in the US. A name
      // that is both a city and a state, "New York" or "Washington", is the
      // city when nothing precedes it.
      loc.region = US_STATE_NAMES[key];
      loc.country = "US";
      continue;
    }
    if (loc.city || /^\d/.test(p)) continue;
    const metro = METRO.exec(p);
    const cityKey = (metro ? metro[1] : p).toLowerCase().replace(/\.$/, "");
    loc.city = canonicalCity(cityKey) ?? (metro ? metro[1] : p);
    if (US_CITIES.has(cityKey)) cityIsUs = true;
  }
  if (!loc.country && cityIsUs) loc.country = "US";
  if (!loc.country && hint?.country) {
    const c = COUNTRY_CODES[hint.country.toLowerCase()] ?? hint.country.toUpperCase();
    if (c.length === 2) loc.country = c;
  }
  return loc;
}

/** ISO code for a country name or code the feed wrote, or undefined when it is not in the table. */
export function countryCodeOf(name: string | undefined): string | undefined {
  if (!name) return undefined;
  const key = name.trim().toLowerCase();
  if (COUNTRY_CODES[key]) return COUNTRY_CODES[key];
  return /^[a-z]{2}$/.test(key) ? key.toUpperCase() : undefined;
}

/**
 * One JobLocation per raw string. The text parse supplies whatever the feed
 * left unstructured; a structured field from the feed overwrites the parsed
 * one, and a structured country wins outright: a code as given, a name
 * through the table, and a name the table does not know kept as
 * `countryName` with `country` left empty rather than guessed.
 */
export function parseLocations(raws: RawLocation[], hint?: { country?: string; remote?: boolean }): JobLocation[] {
  const seen = new Set<string>();
  const out: JobLocation[] = [];
  for (const r of raws) {
    if (!r?.raw || seen.has(r.raw)) continue;
    seen.add(r.raw);
    const loc = parseLocation(r.raw, { remote: hint?.remote || r.remote, country: hint?.country });
    if (r.city) loc.city = r.city;
    if (r.region) loc.region = r.region;
    const code = countryCodeOf(r.countryCode) ?? countryCodeOf(r.country);
    if (code) {
      loc.country = code;
      delete loc.countryName;
    } else if (r.country) {
      delete loc.country;
      loc.countryName = r.country;
    }
    out.push(loc);
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
/**
 * Sentences of a description. A full stop ends a sentence only after a word
 * of at least two letters and before a capital, so "U.S. citizen" and
 * "St. Louis" stay whole.
 */
export function sentencesOf(text: string): string[] {
  return text.split(/(?<=[a-z0-9)][.!?])\s+(?=[A-Z"(])|\n+/);
}

export function sponsorshipOf(text: string): { value: Sponsorship; evidence?: string } {
  const sentences = sentencesOf(text);
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

export type Restriction = "citizenship" | "permanent_residency" | "right_to_work" | "clearance";

/*
 * Sentences that mention the words but are not a restriction: equal
 * opportunity statements, "preferred but not required", "encouraged to
 * apply", Airbnb's "states you are eligible to work from", a visa team's job
 * description, pre-clearance of trades.
 */
const RESTRICTION_GUARD =
  /regardless of|without regard|citizenship status|discriminat|equal (employment )?opportunit|preferred but not required|not required|no clearance|encouraged to apply|pre-clearance|clearance coordination|to work from|visa cases|immigration (team|support|process)|first-class citizen|citizen services|digital citizen/i;
const REQUIRED = /\b(required|must|mandatory|is a requirement|need(s|ed)? to|only|essential|responsible for obtaining)\b/i;
const DEMONYMS: [RegExp, string][] = [
  [/\b(u\.?s\.?a?\.?|united states|american)\b/i, "US"],
  [/\b(u\.?k\.?|united kingdom|british|great britain)\b/i, "GB"],
  [/\b(ireland|irish)\b/i, "IE"],
  [/\b(canada|canadian)\b/i, "CA"],
  [/\b(mexico|mexican)\b/i, "MX"],
  [/\b(australia|australian)\b/i, "AU"],
  [/\b(germany|german)\b/i, "DE"],
  [/\b(france|french)\b/i, "FR"],
  [/\b(netherlands|dutch)\b/i, "NL"],
  [/\b(singapore|singaporean)\b/i, "SG"],
  [/\b(india|indian)\b/i, "IN"],
  [/\b(japan|japanese)\b/i, "JP"],
];

/**
 * A stated eligibility restriction, separate from sponsorship: a posting
 * that says the applicant must already be a citizen, a permanent resident,
 * hold the right to work in a country, or hold a security clearance. The
 * sentence is kept as evidence and the country is read from the sentence
 * when it names one. Everything that is not clearly one of these is nothing:
 * a posting that says nothing carries no restriction (JOB-04).
 */
export function eligibilityOf(text: string): { restriction: Restriction; country?: string; evidence: string } | undefined {
  for (const raw of sentencesOf(text)) {
    const s = raw.trim();
    if (!s || RESTRICTION_GUARD.test(s)) continue;
    let restriction: Restriction | undefined;
    if (/\bclearance\b/i.test(s) && (REQUIRED.test(s) || /^clearance:\s*(an? )?active/i.test(s))) restriction = "clearance";
    else if (/\bcitizens?(hip)?\b/i.test(s) && REQUIRED.test(s)) restriction = "citizenship";
    else if (/\b(green card|permanent residen(t|cy)|lawful permanent)\b/i.test(s) && REQUIRED.test(s)) restriction = "permanent_residency";
    else if (
      /\b(right|eligib\w+|authori[sz]\w+|entitle\w+|legally (able|allowed|permitted)) to (live and )?work in\b/i.test(s) &&
      (REQUIRED.test(s) || /without (visa |the need for |requiring )?sponsorship/i.test(s))
    )
      restriction = "right_to_work";
    if (!restriction) continue;
    const country = DEMONYMS.find(([re]) => re.test(s))?.[1];
    return { restriction, country, evidence: s.slice(0, 300) };
  }
  return undefined;
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
  eligibility?: Restriction;
  eligibilityCountry?: string;
  eligibilityEvidence?: string;
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
  const el = eligibilityOf(descriptionText);
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
    eligibility: el?.restriction,
    eligibilityCountry: el?.country,
    eligibilityEvidence: el?.evidence,
    descriptionText,
    descriptionHtml,
    descriptionCore: core,
    contentHash: contentHash(title, locations, core),
  };
}
