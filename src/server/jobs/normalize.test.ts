import { describe, expect, it } from "vitest";
import {
  contentHash,
  countryCodeOf,
  decodeEntities,
  eligibilityOf,
  descriptionCore,
  detectRepeated,
  htmlToText,
  parseCompensation,
  parseLocation,
  parseLocations,
  sponsorshipOf,
  seniorityOf,
  titleNorm,
} from "./normalize";

describe("titleNorm", () => {
  it("collapses punctuation and case, keeps level words", () => {
    expect(titleNorm("Sr. Product Manager, Growth (Remote)")).toBe("sr product manager growth remote");
    expect(titleNorm("Sr Product Manager  Growth Remote")).toBe("sr product manager growth remote");
    expect(titleNorm("Senior Product Manager")).not.toBe(titleNorm("Sr. Product Manager"));
  });
  it("keeps C++ and C# and .NET apart from C", () => {
    expect(titleNorm("C++ Engineer")).toBe("c++ engineer");
    expect(titleNorm("C# Engineer")).toBe("c# engineer");
  });
});

describe("parseLocation", () => {
  it("reads city, state and country from US forms", () => {
    expect(parseLocation("New York, NY")).toMatchObject({ city: "New York", region: "NY", country: "US" });
    expect(parseLocation("San Francisco, CA (HQ)")).toMatchObject({ city: "San Francisco", region: "CA", country: "US" });
    expect(parseLocation("Remote - US")).toMatchObject({ remote: true, country: "US" });
    expect(parseLocation("Remote (United States)")).toMatchObject({ remote: true, country: "US" });
  });
  it("reads full state names, after a city or alone", () => {
    expect(parseLocation("San Francisco, California")).toMatchObject({ city: "San Francisco", region: "CA", country: "US" });
    expect(parseLocation("New York, New York")).toMatchObject({ city: "New York", region: "NY", country: "US" });
    expect(parseLocation("St. Louis, Missouri")).toMatchObject({ city: "St. Louis", region: "MO", country: "US" });
    expect(parseLocation("Remote - Texas")).toMatchObject({ remote: true, region: "TX", country: "US" });
    expect(parseLocation("California")).toMatchObject({ region: "CA", country: "US" });
    expect(parseLocation("California").city).toBeUndefined();
  });
  it("reads punctuated cities and Washington DC in its forms", () => {
    expect(parseLocation("St. Louis, MO")).toMatchObject({ city: "St. Louis", region: "MO", country: "US" });
    expect(parseLocation("Washington, DC")).toMatchObject({ city: "Washington", region: "DC", country: "US" });
    expect(parseLocation("Washington, D.C.")).toMatchObject({ city: "Washington", region: "DC", country: "US" });
    expect(parseLocation("Washington DC")).toMatchObject({ city: "Washington", region: "DC", country: "US" });
    expect(parseLocation("Ft. Lauderdale, FL")).toMatchObject({ city: "Ft. Lauderdale", region: "FL", country: "US" });
  });
  it("reads metro strings down to the city", () => {
    expect(parseLocation("Greater Boston Area")).toMatchObject({ city: "Boston", country: "US" });
    expect(parseLocation("San Francisco Bay Area")).toMatchObject({ city: "San Francisco", country: "US" });
    expect(parseLocation("New York City Metropolitan Area")).toMatchObject({ city: "New York", country: "US" });
    expect(parseLocation("Greater Seattle Area")).toMatchObject({ city: "Seattle", country: "US" });
  });
  it("reads every Remote US variant as remote in the US, with no city", () => {
    const variants = [
      "Remote, US",
      "Remote - USA",
      "US Remote",
      "Remote (US)",
      "United States - Remote",
      "Remote, United States",
      "Remote in the USA",
      "Remote - Anywhere in the US",
      "US - Remote",
    ];
    for (const s of variants) {
      const l = parseLocation(s);
      expect(l, s).toMatchObject({ remote: true, country: "US" });
      expect(l.city, s).toBeUndefined();
    }
    expect(parseLocation("Remote")).toMatchObject({ remote: true });
    expect(parseLocation("Remote").country).toBeUndefined();
  });
  it("is not fooled by a location or an entity named like a key on Object.prototype", () => {
    const loc = parseLocation("Constructor, Prototype");
    expect(loc.city).toBe("Constructor");
    expect(loc.country).toBeUndefined();
    expect(loc.region).toBeUndefined();
    expect(parseLocation("Berlin, constructor").country).toBeUndefined();
    expect(decodeEntities("a &constructor; b &amp; c")).toBe("a &constructor; b & c");
    expect(countryCodeOf("constructor")).toBeUndefined();
  });

  it("reads a well known US city on its own, and no other city", () => {
    expect(parseLocation("Chicago")).toMatchObject({ city: "Chicago", country: "US" });
    expect(parseLocation("NYC")).toMatchObject({ city: "New York", country: "US" });
    expect(parseLocation("Cambridge").country).toBeUndefined();
    expect(parseLocation("London").country).toBeUndefined();
    expect(parseLocation("Dublin")).toMatchObject({ city: "Dublin" });
    expect(parseLocation("Dublin").country).toBeUndefined();
  });
  it("reads a two letter code after a city by context: state, country, or unknown", () => {
    expect(parseLocation("Berlin, DE")).toMatchObject({ city: "Berlin", country: "DE" });
    expect(parseLocation("Berlin, DE").region).toBeUndefined();
    expect(parseLocation("Toronto, CA")).toMatchObject({ city: "Toronto", country: "CA" });
    expect(parseLocation("Bengaluru, IN")).toMatchObject({ city: "Bengaluru", country: "IN" });
    expect(parseLocation("San Francisco, CA")).toMatchObject({ city: "San Francisco", region: "CA", country: "US" });
    expect(parseLocation("Indianapolis, IN")).toMatchObject({ city: "Indianapolis", region: "IN", country: "US" });
    expect(parseLocation("Austin, TX")).toMatchObject({ city: "Austin", region: "TX", country: "US" });
    expect(parseLocation("South San Francisco, CA")).toMatchObject({ city: "South San Francisco", region: "CA", country: "US" });
    expect(parseLocation("Dover, DE")).toMatchObject({ city: "Dover", region: "DE", country: "US" });
    expect(parseLocation("Lyon, FR")).toMatchObject({ city: "Lyon", country: "FR" });
    // Both a state and a country, after a city the table does not know: left unknown, not guessed.
    const ambiguous = parseLocation("Nowhereville, DE");
    expect(ambiguous.city).toBe("Nowhereville");
    expect(ambiguous.country).toBeUndefined();
    expect(ambiguous.region).toBeUndefined();
    // A structured country from the feed still wins over all of it.
    expect(parseLocations([{ raw: "Nowhereville, DE", countryCode: "US" }])[0]).toMatchObject({ city: "Nowhereville", country: "US" });
  });
  it("reads other countries and leaves the unknown alone", () => {
    expect(parseLocation("London, United Kingdom")).toMatchObject({ city: "London", country: "GB" });
    expect(parseLocation("Paris, France")).toMatchObject({ city: "Paris", country: "FR" });
    expect(parseLocation("Remote (Canada)")).toMatchObject({ remote: true, country: "CA" });
    expect(parseLocation("Toronto, ON")).toMatchObject({ city: "Toronto" });
    expect(parseLocation("Toronto, ON").country).toBeUndefined();
    expect(parseLocation("Campinas, SP", { country: "br" })).toMatchObject({ city: "Campinas", country: "BR" });
  });
  it("invents nothing for a string it cannot read", () => {
    for (const s of ["N/A", "TBD", "Multiple locations", "Various"]) {
      const l = parseLocation(s);
      expect(l.raw, s).toBe(s);
      expect(l.city, s).toBeUndefined();
      expect(l.country, s).toBeUndefined();
    }
  });
});

describe("parseLocations with structured fields from the feed", () => {
  it("lets a country code from the feed win over the text, and never guesses", () => {
    expect(parseLocations([{ raw: "Paris, Texas", countryCode: "FR" }])[0]).toMatchObject({ city: "Paris", country: "FR" });
    expect(parseLocations([{ raw: "London", countryCode: "gb" }])[0]).toMatchObject({ city: "London", country: "GB" });
    expect(parseLocations([{ raw: "London" }])[0].country).toBeUndefined();
  });
  it("maps a country name through the table and keeps an unknown name as countryName", () => {
    expect(parseLocations([{ raw: "Halifax, England, United Kingdom", city: "Halifax", region: "England", country: "United Kingdom" }])[0]).toMatchObject({
      city: "Halifax",
      region: "England",
      country: "GB",
    });
    const odd = parseLocations([{ raw: "Somewhere", country: "Atlantis" }])[0];
    expect(odd.country).toBeUndefined();
    expect(odd.countryName).toBe("Atlantis");
  });
  it("takes structured city and region over the parsed ones and keeps the remote flag", () => {
    const l = parseLocations([{ raw: "Paris, IDF, France", city: "Paris", region: "IDF", countryCode: "FR", remote: true }])[0];
    expect(l).toMatchObject({ raw: "Paris, IDF, France", city: "Paris", region: "IDF", country: "FR", remote: true });
  });
  it("still parses free text entries that carry no structure", () => {
    expect(parseLocations([{ raw: "San Francisco, CA" }, { raw: "Remote - US" }])).toEqual([
      { raw: "San Francisco, CA", city: "San Francisco", region: "CA", country: "US" },
      { raw: "Remote - US", remote: true, country: "US" },
    ]);
  });
});

describe("eligibilityOf", () => {
  it("reads a stated restriction with the sentence as evidence and the country it names", () => {
    expect(eligibilityOf("Great team. Right to work in the UK is required. Apply now.")).toMatchObject({
      restriction: "right_to_work",
      country: "GB",
      evidence: "Right to work in the UK is required.",
    });
    expect(eligibilityOf("Candidates must have the right to work in Ireland by the start date.")).toMatchObject({ restriction: "right_to_work", country: "IE" });
    expect(eligibilityOf("Applicants are personally responsible for obtaining and maintaining the right to work in Mexico.")).toMatchObject({
      restriction: "right_to_work",
      country: "MX",
    });
    expect(eligibilityOf("Must be a U.S. citizen due to contract requirements.")).toMatchObject({ restriction: "citizenship", country: "US" });
    expect(eligibilityOf("US citizenship is required for this role.")).toMatchObject({ restriction: "citizenship", country: "US" });
    expect(eligibilityOf("Green card or permanent residency required.")).toMatchObject({ restriction: "permanent_residency" });
    expect(eligibilityOf("An active Top Secret security clearance is required.")).toMatchObject({ restriction: "clearance" });
    expect(eligibilityOf("Clearance: An active U.S. Secret clearance.")).toMatchObject({ restriction: "clearance", country: "US" });
    expect(eligibilityOf("Must be legally authorized to work in the United States without sponsorship.")).toMatchObject({ restriction: "right_to_work", country: "US" });
  });
  it("finds nothing in the sentences that only mention the words", () => {
    const none = [
      "Datadog is proud to offer equal employment opportunity to everyone regardless of race, color, ancestry, religion, sex, national origin, sexual orientation, age, citizenship, marital status, disability.",
      "If your position is employed by another Airbnb entity, your recruiter will inform you what states you are eligible to work from.",
      "Clearance: An active U.S. government security clearance is preferred but not required. Candidates without an active clearance are encouraged to apply.",
      "Support Section 16 officer transactions, including Rule 10b5-1 trading plan administration and pre-clearance coordination.",
      "We are making Stripe's data lake a first-class citizen of the modern data ecosystem.",
      "Manage UK and Canadian visa cases from offer stage through renewals and permanent residency.",
      "We welcome applicants from every background.",
      "",
    ];
    for (const s of none) expect(eligibilityOf(s), s).toBeUndefined();
  });
});

describe("titleNorm", () => {
  it("keeps letters and digits of every script", () => {
    expect(titleNorm("ソフトウェアエンジニア (東京)")).toBe("ソフトウェアエンジニア 東京");
    expect(titleNorm("مهندس برمجيات")).toBe("مهندس برمجيات");
    expect(titleNorm("Développeur C++ / Sr. Ingénieur")).toBe("développeur c++ sr ingénieur");
    expect(titleNorm("Sr. PM - Growth")).toBe("sr pm growth");
  });
});

describe("sponsorshipOf across sentences", () => {
  it("reads every relevant sentence and lets a stated no win", () => {
    expect(sponsorshipOf("You must have work authorization for the role. We cannot provide visa sponsorship at this time.")).toMatchObject({
      value: "not_offered",
      evidence: "We cannot provide visa sponsorship at this time.",
    });
    expect(sponsorshipOf("We sponsor visas for many roles. This role cannot be sponsored.")).toMatchObject({ value: "not_offered" });
    expect(sponsorshipOf("Great team. We are happy to sponsor visas for this role.")).toMatchObject({ value: "offered" });
    expect(sponsorshipOf("Applicants must be authorized to work in the US without sponsorship.")).toMatchObject({ value: "not_offered" });
    expect(sponsorshipOf("Visa questions go to our immigration team.")).toMatchObject({ value: "unknown" });
    expect(sponsorshipOf("We can sponsor H-1B visas for this role.")).toMatchObject({ value: "offered" });
  });
  it("does not read project sponsors, event sponsorships or a relocation sponsor as visa sponsorship", () => {
    for (const s of [
      "You will work closely with project sponsors and designated project managers.",
      "Your focus will be on planning a curated slate of events and sponsorships across the region.",
      "We will sponsor you for relocation if you need to move for this role.",
      "Provide executive-level engagement and sponsorship on the most strategic accounts.",
    ]) {
      expect(sponsorshipOf(s).value, s).toBe("unknown");
    }
    expect(sponsorshipOf("Nothing about it here.")).toEqual({ value: "unknown" });
  });
});

describe("eligibilityOf alternatives and conjunctions", () => {
  it("keeps 'or' as alternatives and 'and' as one conjunction", () => {
    const either = eligibilityOf("Must be a US citizen or permanent resident.");
    expect(either).toMatchObject({ restriction: "citizenship", country: "US", options: [["citizenship"], ["permanent_residency"]] });
    const both = eligibilityOf("US citizenship and an active security clearance are required.");
    expect(both).toMatchObject({ options: [["citizenship", "clearance"]] });
    const one = eligibilityOf("Right to work in the UK is required.");
    expect(one).toMatchObject({ restriction: "right_to_work", options: [["right_to_work"]] });
  });
});

describe("parseCompensation", () => {
  it("keeps the stated currency and period and never infers annual from the size of the number", () => {
    expect(parseCompensation("CAD 90,000 - 110,000 a year")).toMatchObject({ min: 90000, max: 110000, currency: "CAD", period: "year" });
    expect(parseCompensation("EUR 4.500 - 5.200 per month")).toMatchObject({ min: 4500, max: 5200, currency: "EUR", period: "month" });
    expect(parseCompensation("EUR 70.000")).toMatchObject({ min: 70000, max: 70000, currency: "EUR", period: "unknown" });
    expect(parseCompensation("£45,000")).toMatchObject({ currency: "GBP", period: "unknown" });
    expect(parseCompensation("$35 an hour")).toMatchObject({ min: 35, currency: "USD", period: "hour" });
    expect(parseCompensation("A$120k")).toMatchObject({ min: 120000, currency: "AUD", period: "year" });
    expect(parseCompensation("90,000 - 110,000")).toMatchObject({ min: 90000, currency: undefined, period: "unknown" });
    expect(parseCompensation("CAD 90,000 - 110,000 a year")?.raw).toBe("CAD 90,000 - 110,000 a year");
  });
  it("reads Ashby and free text ranges", () => {
    expect(parseCompensation("$211.4K – $290.6K • Offers Equity")).toMatchObject({ min: 211400, max: 290600, currency: "USD", period: "year" });
    expect(parseCompensation("USD 150,000 - 175,000 per year")).toMatchObject({ min: 150000, max: 175000, period: "year" });
    expect(parseCompensation("$45/hr")).toMatchObject({ min: 45, max: 45, period: "hour" });
    expect(parseCompensation("Competitive")).toBeUndefined();
  });
});

describe("sponsorshipOf", () => {
  it("reads offered, not offered and unknown with evidence", () => {
    expect(sponsorshipOf("We will sponsor visas for this role.")).toMatchObject({ value: "offered" });
    expect(sponsorshipOf("We are unable to sponsor visas at this time.")).toMatchObject({ value: "not_offered" });
    expect(sponsorshipOf("Great benefits and a fun team.")).toEqual({ value: "unknown" });
    expect(sponsorshipOf("Visa questions are handled by HR.").evidence).toContain("Visa");
  });
});

describe("seniorityOf", () => {
  it("maps title words to a level", () => {
    expect(seniorityOf("Senior Software Engineer")).toBe("Senior");
    expect(seniorityOf("Director, Corporate Strategy")).toBe("Director");
    expect(seniorityOf("Software Engineer")).toBeUndefined();
  });
});

describe("htmlToText", () => {
  it("decodes the double encoded Greenhouse body and keeps paragraphs", () => {
    const text = htmlToText("&lt;div&gt;&lt;p&gt;Hello &amp;amp; welcome&lt;/p&gt;&lt;ul&gt;&lt;li&gt;One&lt;/li&gt;&lt;/ul&gt;&lt;/div&gt;");
    expect(text).toContain("Hello & welcome");
    expect(text).toContain("- One");
  });
});

describe("boilerplate", () => {
  const eeo = "Acme is an equal opportunity employer and considers all applicants without regard to race, colour or age.";
  const blurb = "Acme builds the smart infrastructure for finance teams, embedded in the transaction flow of every purchase.";
  const roleA = "You will design and ship the payments ledger, working with three engineers and a designer.";
  const roleB = "You will lead the mobile client platform team across iOS and Android surfaces.";
  const a = `${blurb}\n\n${roleA}\n\n${eeo}`;
  const b = `${blurb}\n\n${roleB}\n\n${eeo}`;

  it("detects paragraphs repeated across jobs of one source, once enough of the board shares them", () => {
    const c = `${blurb}

A third role with its own duties and its own wording that no other posting repeats.

${eeo}`;
    expect(detectRepeated([a, b])).toEqual([]);
    const detected = detectRepeated([a, b, c]);
    expect(detected).toContain(blurb);
    expect(detected).not.toContain(roleA);
  });
  it("strips detected and fixed phrase boilerplate from the core", () => {
    const core = descriptionCore(a, [blurb]);
    expect(core).toBe(roleA);
  });
  it("keeps the content hash stable across whitespace and punctuation noise, on a core that is not empty", () => {
    const locs = [{ raw: "New York, NY" }];
    const a = "You will ship the ledger service and own its reliability targets.\n\n\n\nYou will  work with  three teams across two time zones.";
    const b = "You will ship the ledger service and own its reliability targets.\n\nYou will work with three teams across two time zones.";
    const coreA = descriptionCore(a, []);
    expect(coreA.length).toBeGreaterThan(80);
    expect(contentHash("Sr. PM", locs, coreA)).toBe(contentHash("Sr PM", locs, descriptionCore(b, [])));
    expect(contentHash("Sr PM", locs, coreA + " And more.")).not.toBe(contentHash("Sr PM", locs, coreA));
  });
  it("keeps short bullets in the core, so a role written as bullets is not empty", () => {
    const bullets = "- Own the ledger\n\n- Ship weekly\n\n- Mentor two engineers";
    expect(descriptionCore(bullets, [])).toBe(bullets);
    expect(contentHash("Ledger Engineer", [], descriptionCore(bullets, []))).not.toBe(contentHash("Ledger Engineer", [], ""));
  });
  it("treats a paragraph as boilerplate only when a share of the board repeats it", () => {
    const eeo = "We are an equal chance employer and welcome applications from everyone regardless of background.";
    const shared = "You have five years of experience running distributed systems in production at scale.";
    const texts = Array.from({ length: 20 }, (_, i) => `Role ${i}.\n\n${eeo}${i < 2 ? `\n\n${shared}` : ""}`);
    const detected = detectRepeated(texts);
    expect(detected).toContain(eeo);
    expect(detected).not.toContain(shared);
    expect(detectRepeated(["Short.\n\nToo short to count.", "Short.\n\nToo short to count.", "Short.\n\nToo short to count."])).toEqual([]);
  });
});
