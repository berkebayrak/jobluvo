import { describe, expect, it } from "vitest";
import {
  contentHash,
  descriptionCore,
  detectRepeated,
  htmlToText,
  parseCompensation,
  parseLocation,
  seniorityOf,
  sponsorshipOf,
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
  it("reads a well known US city on its own, and no other city", () => {
    expect(parseLocation("Chicago")).toMatchObject({ city: "Chicago", country: "US" });
    expect(parseLocation("NYC")).toMatchObject({ city: "New York", country: "US" });
    expect(parseLocation("Cambridge").country).toBeUndefined();
    expect(parseLocation("London").country).toBeUndefined();
    expect(parseLocation("Dublin")).toMatchObject({ city: "Dublin" });
    expect(parseLocation("Dublin").country).toBeUndefined();
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

describe("parseCompensation", () => {
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

  it("detects paragraphs repeated across jobs of one source", () => {
    const detected = detectRepeated([a, b]);
    expect(detected).toContain(blurb);
    expect(detected).not.toContain(roleA);
  });
  it("strips detected and fixed phrase boilerplate from the core", () => {
    const core = descriptionCore(a, [blurb]);
    expect(core).toBe(roleA);
  });
  it("keeps the content hash stable across whitespace and punctuation noise", () => {
    const locs = [{ raw: "New York, NY" }];
    const h1 = contentHash("Sr. PM", locs, descriptionCore("You  will ship.\n\n\n\nA lot.", []));
    const h2 = contentHash("Sr PM", locs, descriptionCore("You will ship.\n\nA lot.", []));
    expect(h1).toBe(h2);
    expect(contentHash("Sr PM", locs, "You will ship. A lot more.")).not.toBe(h1);
  });
});
