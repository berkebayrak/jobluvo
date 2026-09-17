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
/** Lower case, punctuation and whitespace collapsed, every script's letters and digits kept: a Japanese or Arabic title is not an empty string. */
export function titleNorm(title: string): string {
  return title
    .toLowerCase()
    .replace(/[‐-―]/g, "-")
    .replace(/[^\p{L}\p{N}+#./\s-]/gu, " ")
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
  // Cities whose two letter state code is also a country code, so the table is what reads them as US.
  "south san francisco", "san mateo", "foster city", "burlingame", "berkeley", "emeryville", "fremont", "san bruno", "daly city",
  "walnut creek", "pleasanton", "san ramon", "santa cruz", "los gatos", "campbell", "milpitas", "hayward", "san rafael",
  "dover", "wilmington", "fort wayne", "colorado springs", "aurora", "savannah", "boise", "springfield", "baton rouge",
  "worcester", "lowell", "somerville", "annapolis", "bethesda", "rockville", "st. paul", "saint paul", "billings", "missoula",
  "lincoln", "harrisburg", "columbia", "charleston", "sioux falls", "knoxville", "chattanooga", "mclean", "tysons", "herndon", "chantilly",
]);
const METRO = /^(?:greater\s+)?(.+?)\s+(?:bay\s+area|metropolitan\s+area|metro(?:politan)?\s+area|metro|area)$/i;
/*
 * Cities outside the US whose two letter code after them is also a US state
 * code: "Berlin, DE", "Toronto, CA", "Bengaluru, IN", "Tel Aviv, IL". The
 * table is the context that resolves the code; a city in neither table with
 * such a code is left unknown rather than guessed.
 */
const NON_US_CITIES: Record<string, string> = {
  berlin: "DE", munich: "DE", münchen: "DE", hamburg: "DE", frankfurt: "DE", cologne: "DE", köln: "DE", düsseldorf: "DE", stuttgart: "DE",
  toronto: "CA", vancouver: "CA", montreal: "CA", montréal: "CA", ottawa: "CA", calgary: "CA", edmonton: "CA", waterloo: "CA", quebec: "CA", québec: "CA",
  bengaluru: "IN", bangalore: "IN", mumbai: "IN", delhi: "IN", "new delhi": "IN", hyderabad: "IN", pune: "IN", chennai: "IN", gurugram: "IN", gurgaon: "IN", noida: "IN", kolkata: "IN",
  "tel aviv": "IL", jerusalem: "IL", haifa: "IL",
  bogotá: "CO", bogota: "CO", medellín: "CO", medellin: "CO",
  "panama city": "PA",
  "buenos aires": "AR",
  jakarta: "ID",
  "kuala lumpur": "MY",
};
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
        .replace(/^\s*(?:anywhere|any|all)?\s*(?:in|within|from|across)\b(?:\s+the)?\s+(?=\S)/i, "")
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
    // A two letter code after a city: "San Francisco, CA" is California,
    // "Toronto, CA" is Canada, "Berlin, DE" is Germany, "Bengaluru, IN" is
    // India. Context decides: a city in the US table makes it a state, a
    // code that is only a country makes it a country, a code that is only a
    // state makes it a state, and a code that is both after a city the
    // table does not know is left unknown rather than guessed.
    if (loc.city && key.length === 2) {
      const isState = US_STATES.has(key);
      const isCountry = !!COUNTRY_CODES[key];
      const cityKey = loc.city.toLowerCase();
      const usCity = US_CITIES.has(cityKey);
      const abroad = NON_US_CITIES[cityKey];
      if (isState && (usCity || !isCountry)) {
        loc.region = key.toUpperCase();
        loc.country = "US";
        continue;
      }
      if (isCountry && (!isState || abroad === COUNTRY_CODES[key])) {
        loc.country = COUNTRY_CODES[key];
        continue;
      }
      if (isState && isCountry) continue;
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
  period: "year" | "month" | "hour" | "unknown";
  /** The text the board gave, kept so the numbers can be reparsed without a fetch. */
  raw?: string;
}

/** Reads "$211.4K – $290.6K", "USD 150,000 - 175,000", "$45/hr" and the like. */
const CURRENCY_CODES = /\b(USD|EUR|GBP|CAD|AUD|NZD|CHF|SGD|HKD|JPY|INR|SEK|NOK|DKK|PLN|CZK|HUF|BRL|MXN|ZAR|AED|TRY|ILS|KRW|CNY)\b/i;
const CURRENCY_SYMBOLS: [RegExp, string][] = [
  [/(?:^|[^A-Za-z])(CA\$|C\$)/i, "CAD"],
  [/(?:^|[^A-Za-z])(A\$|AU\$)/i, "AUD"],
  [/(?:^|[^A-Za-z])(NZ\$)/i, "NZD"],
  [/(?:^|[^A-Za-z])(S\$)/i, "SGD"],
  [/(?:^|[^A-Za-z])(HK\$)/i, "HKD"],
  [/(?:^|[^A-Za-z])(US\$)/i, "USD"],
  [/€/, "EUR"],
  [/£/, "GBP"],
  [/₹/, "INR"],
  [/¥/, "JPY"],
  [/\$/, "USD"],
];

/** "70.000" and "70,000" are seventy thousand; "70.5" is seventy and a half. */
function amount(raw: string): number {
  if (/^\d{1,3}(?:[.,]\d{3})+$/.test(raw)) return Number(raw.replace(/[.,]/g, ""));
  return Number(raw.replace(/,/g, ""));
}

/**
 * The stated currency and the stated period, nothing inferred from the size
 * of the number: "CAD 90,000" is Canadian dollars, "EUR 4.500 a month" is
 * monthly, "EUR 70.000" is seventy thousand. A number with no currency and
 * no period is stored with both unknown, and the original text is kept so a
 * better reading can be applied without fetching again.
 */
export function parseCompensation(s: string | undefined): Compensation | undefined {
  if (!s?.trim()) return undefined;
  const text = s.replace(/–|—/g, "-");
  const nums = [...text.matchAll(/(\d{1,3}(?:[,.]\d{3})+|\d+(?:[.,]\d+)?)\s*(k|m)?\b/gi)];
  const values = nums
    .map((m) => {
      let n = amount(m[1]);
      if (m[2]?.toLowerCase() === "k") n *= 1_000;
      if (m[2]?.toLowerCase() === "m") n *= 1_000_000;
      return n;
    })
    .filter((n) => n >= 10 && n < 5_000_000);
  if (!values.length) return undefined;
  const code = CURRENCY_CODES.exec(text)?.[1].toUpperCase();
  const currency = code ?? CURRENCY_SYMBOLS.find(([re]) => re.test(text))?.[1];
  const period: Compensation["period"] = /\/\s*(hr|hour)\b|per hour|hourly|an hour/i.test(text)
    ? "hour"
    : /\/\s*(mo|month)\b|per month|monthly|a month|\bpm\b/i.test(text)
      ? "month"
      : /\byear\b|annual|per annum|\/\s*(yr|year|annum)\b|\bpa\b|\bp\.a\.|\d\s*k\b/i.test(text)
        ? "year"
        : "unknown";
  return { min: Math.min(...values), max: Math.max(...values), currency, period, raw: s.trim().slice(0, 200) };
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

const SPONSOR_TOPIC = /\b(sponsor\w*|visas?|h-?1b|work authori[sz]ation)\b/i;
/** Sponsors that are not visa sponsors: project sponsors, event sponsorships, a relocation sponsor. */
const SPONSOR_OTHER =
  /\b(project|executive|business|internal|event|events|marketing|brand|sales|stakeholder|corporate)s?\s+sponsor|sponsorships?\s+(across|deals?|packages?|revenue|sales)|events? and sponsorships?|\brelocation\b|sponsorship on the/i;
/** A yes has to be about a visa: "we sponsor visas", "H-1B sponsorship is available", "we can sponsor work authorization". */
const VISA_CONTEXT = /\b(visas?|h-?1b|immigration|work authori[sz]ation|work permit|employment authori[sz]ation|right to work)\b/i;
const SPONSOR_NO =
  /\b(not|unable|cannot|can't|won't|will not|no|never|don't|do not|does not)\b[^.]*\bsponsor\w*\b|\bsponsor\w*\b[^.]*\b(is not|are not|not available|unavailable|not provided|not offered)\b|must be authori[sz]ed[^.]*without|without (visa |the need for |requiring )?sponsorship/i;
const SPONSOR_YES = /\b(will|can|able to|offers?|provide[sd]?|happy to|open to|available)\b[^.]*\bsponsor/i;

/**
 * Every sentence that touches the subject is read, not only the first. A
 * stated no wins over a stated yes, so "we sponsor for some roles" followed
 * by "this role cannot be sponsored" is a no, and "you must have work
 * authorization" followed by "we cannot provide visa sponsorship" is a no
 * rather than an unknown. Only what the posting says; the deciding sentence
 * is the evidence.
 */
export function sponsorshipOf(text: string): { value: Sponsorship; evidence?: string } {
  const hits = sentencesOf(text)
    .map((s) => s.trim())
    .filter((s) => SPONSOR_TOPIC.test(s) && !SPONSOR_OTHER.test(s));
  if (!hits.length) return { value: "unknown" };
  const no = hits.find((s) => SPONSOR_NO.test(s));
  if (no) return { value: "not_offered", evidence: no.slice(0, 300) };
  const yes = hits.find((s) => VISA_CONTEXT.test(s) && SPONSOR_YES.test(s));
  if (yes) return { value: "offered", evidence: yes.slice(0, 300) };
  return { value: "unknown", evidence: hits[0].slice(0, 300) };
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
/**
 * The restrictions one sentence states, as alternatives of conjunctions:
 * "US citizens or permanent residents" is [["citizenship"], ["permanent_residency"]],
 * one of which must be met; "US citizenship and an active clearance" is
 * [["citizenship", "clearance"]], all of which must be met. `restriction` is
 * the first alternative's first term, kept for the card and the reports.
 */
export interface Eligibility {
  restriction: Restriction;
  options: Restriction[][];
  country?: string;
  evidence: string;
}

const RESTRICTION_TERMS: [RegExp, Restriction][] = [
  [/\bclearance\b/i, "clearance"],
  [/\bcitizens?(hip)?\b/i, "citizenship"],
  [/\b(green card|permanent residen(t|cy)|lawful permanent)\b/i, "permanent_residency"],
  [/\b(right|eligib\w+|authori[sz]\w+|entitle\w+|legally (able|allowed|permitted)) to (live and )?work in\b/i, "right_to_work"],
];

export function eligibilityOf(text: string): Eligibility | undefined {
  for (const raw of sentencesOf(text)) {
    const s = raw.trim();
    if (!s || RESTRICTION_GUARD.test(s)) continue;
    const required = REQUIRED.test(s) || /^clearance:\s*(an? )?active/i.test(s) || /without (visa |the need for |requiring )?sponsorship/i.test(s);
    if (!required) continue;
    // Terms in the order they appear, so "citizens or permanent residents"
    // and "citizenship and a clearance" keep their shape.
    const found = RESTRICTION_TERMS.flatMap(([re, r]) => {
      const m = re.exec(s);
      return m ? [{ at: m.index, r }] : [];
    }).sort((a, b) => a.at - b.at);
    if (!found.length) continue;
    const terms = found.map((f) => f.r);
    const between = (i: number) => s.slice(found[i].at, found[i + 1].at);
    let options: Restriction[][] = [[terms[0]]];
    for (let i = 1; i < terms.length; i += 1) {
      if (/\b(or|either)\b|\/|,\s*or\b/i.test(between(i - 1))) options.push([terms[i]]);
      else options[options.length - 1].push(terms[i]);
    }
    options = options.map((o) => [...new Set(o)]);
    const country = DEMONYMS.find(([re]) => re.test(s))?.[1];
    return { restriction: options[0][0], options, country, evidence: s.slice(0, 300) };
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

/** Paragraphs of a description. `minLength` is a floor for boilerplate candidates only; the core keeps every paragraph. */
export function paragraphsOf(text: string, minLength = 1): string[] {
  return text
    .split(/\n\s*\n/)
    .map((p) => normaliseWhitespace(p))
    .filter((p) => p.length >= minLength);
}

/** A paragraph shorter than this is never boilerplate: too short to be a statement that repeats verbatim on purpose. */
export const BOILERPLATE_MIN_LENGTH = 40;

/**
 * How many jobs of a board must share a paragraph verbatim before it is
 * boilerplate: at least three, and at least one in twenty of the board. Two
 * jobs sharing a paragraph is what genuine shared qualifications look like.
 * One in ten missed Datadog's benefits block, which sits in 45 of 453
 * postings because sales roles carry their own; one in twenty catches it and
 * still leaves a paragraph two or three roles share alone on a large board.
 */
export function boilerplateMinCount(boardSize: number): number {
  return Math.max(3, Math.ceil(boardSize * 0.05));
}

export function isFixedBoilerplate(p: string): boolean {
  return FIXED_PHRASES.some((re) => re.test(p));
}

/** Paragraphs that appear verbatim in at least `minCount` of the given texts. */
export function detectRepeated(texts: string[], minCount = boilerplateMinCount(texts.length)): string[] {
  const counts = new Map<string, number>();
  for (const t of texts) {
    for (const p of new Set(paragraphsOf(t, BOILERPLATE_MIN_LENGTH))) counts.set(p, (counts.get(p) ?? 0) + 1);
  }
  return [...counts.entries()].filter(([, n]) => n >= minCount).map(([p]) => p);
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
  eligibilityOptions?: Restriction[][];
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
    eligibilityOptions: el?.options,
    eligibilityCountry: el?.country,
    eligibilityEvidence: el?.evidence,
    descriptionText,
    descriptionHtml,
    descriptionCore: core,
    contentHash: contentHash(title, locations, core),
  };
}
