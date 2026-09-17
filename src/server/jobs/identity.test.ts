import { describe, expect, it } from "vitest";
import type { JobLocation } from "@/db/schema";
import { locationsOverlap, lockKey, normaliseApplyUrl, requisitionConflict } from "./identity";

describe("normaliseApplyUrl", () => {
  it("drops every parameter that does not identify the job, plus fragments, case and trailing slashes", () => {
    const a = normaliseApplyUrl("https://boards.greenhouse.io/stripe/jobs/123?gh_src=abc&utm_source=linkedin#top", "greenhouse");
    const b = normaliseApplyUrl("https://Boards.Greenhouse.io/stripe/jobs/123/", "greenhouse");
    expect(a).toBe(b);
    expect(a).toBe("https://boards.greenhouse.io/stripe/jobs/123");
  });
  it("keeps only the family's identifying parameters, so a language switch is the same job", () => {
    const en = normaliseApplyUrl("https://careers.airbnb.com/positions/8184174?gh_jid=8184174&lang=en&gh_src=x", "greenhouse");
    const fr = normaliseApplyUrl("https://careers.airbnb.com/positions/8184174?lang=fr&gh_jid=8184174", "greenhouse");
    expect(en).toBe("https://careers.airbnb.com/positions/8184174?gh_jid=8184174");
    expect(fr).toBe(en);
    expect(normaliseApplyUrl("https://stripe.com/jobs/search?gh_jid=1", "greenhouse")).not.toBe(
      normaliseApplyUrl("https://stripe.com/jobs/search?gh_jid=2", "greenhouse"),
    );
  });
  it("keeps nothing from the query for a family with no identifying parameters, or with no family", () => {
    expect(normaliseApplyUrl("https://jobs.lever.co/spotify/abc?lever-source=LinkedIn&ref=1", "lever")).toBe("https://jobs.lever.co/spotify/abc");
    expect(normaliseApplyUrl("https://x.com/j?gh_jid=1&b=2")).toBe("https://x.com/j");
  });
  it("strips www and forces https", () => {
    expect(normaliseApplyUrl("http://www.example.com/jobs/1")).toBe("https://example.com/jobs/1");
  });
  it("falls back to lowercase trim for something that is not a URL", () => {
    expect(normaliseApplyUrl("  Not A Url ")).toBe("not a url");
  });
});

describe("lockKey", () => {
  it("uses the company domain, then family and tenant", () => {
    expect(lockKey({ companyDomain: "stripe.com", family: "greenhouse", tenant: "stripe" })).toBe("stripe.com");
    expect(lockKey({ companyDomain: null, family: "lever", tenant: "acme" })).toBe("lever|acme");
  });
});

const at = (workplace: string, ...locations: JobLocation[]) => ({ id: workplace, workplace, locations });
const city = (city: string, country?: string): JobLocation => ({ raw: `${city}, ${country ?? ""}`.trim(), city, country });
const remoteIn = (country?: string): JobLocation => ({ raw: country ? `Remote, ${country}` : "Remote", remote: true, country });

describe("locationsOverlap", () => {
  it("two remote roles restricted to different countries are two opportunities", () => {
    expect(locationsOverlap(at("remote", remoteIn("US")), at("remote", remoteIn("DE")))).toBe(false);
    expect(locationsOverlap(at("remote", city("London", "GB")), at("remote", city("New York", "US")))).toBe(false);
  });

  it("a remote role that names no country is unrestricted, so it still overlaps", () => {
    expect(locationsOverlap(at("remote", remoteIn()), at("remote", remoteIn("DE")))).toBe(true);
    expect(locationsOverlap(at("remote"), at("remote", remoteIn("US")))).toBe(true);
  });

  it("two remote roles that share a country overlap, whatever else they list", () => {
    expect(locationsOverlap(at("remote", remoteIn("US"), remoteIn("CA")), at("remote", remoteIn("CA")))).toBe(true);
  });

  it("the same city name in two countries is not the same place", () => {
    expect(locationsOverlap(at("onsite", city("Cambridge", "GB")), at("onsite", city("Cambridge", "US")))).toBe(false);
    expect(locationsOverlap(at("onsite", city("Cambridge", "GB")), at("onsite", city("Cambridge", "GB")))).toBe(true);
  });

  it("a country wide posting meets a city in that country, and not one outside it", () => {
    const usWide: JobLocation = { raw: "United States", country: "US" };
    expect(locationsOverlap(at("onsite", usWide), at("onsite", city("Austin", "US")))).toBe(true);
    expect(locationsOverlap(at("onsite", usWide), at("onsite", city("Berlin", "DE")))).toBe(false);
  });

  it("an unresolved country name is unknown, not a different country", () => {
    const named: JobLocation = { raw: "Cambridge, Wakanda", city: "Cambridge", countryName: "Wakanda" };
    expect(locationsOverlap(at("onsite", named), at("onsite", city("Cambridge", "GB")))).toBe(true);
    expect(locationsOverlap(at("onsite", named), at("onsite", city("Berlin", "DE")))).toBe(false);
  });

  it("falls back to the raw string when neither side names a country", () => {
    expect(locationsOverlap(at("onsite", { raw: "Somewhere" }), at("onsite", { raw: "somewhere" }))).toBe(true);
    expect(locationsOverlap(at("onsite", { raw: "Somewhere" }), at("onsite", { raw: "Elsewhere" }))).toBe(false);
  });
});

describe("requisitionConflict", () => {
  it("two different ids from one board are two openings", () => {
    expect(requisitionConflict("greenhouse", "R11622", "greenhouse", "R14577")).toBe(true);
  });

  it("the same id is not a conflict", () => {
    expect(requisitionConflict("greenhouse", "R11622", "greenhouse", "R11622")).toBe(false);
  });

  it("ids from different boards are two schemes and say nothing, so syndication still merges", () => {
    expect(requisitionConflict("greenhouse", "R11622", "workable", "WKR-8811")).toBe(false);
  });

  it("a placeholder with no digit is ignored on either side", () => {
    expect(requisitionConflict("greenhouse", "ONE", "greenhouse", "MULTI")).toBe(false);
    expect(requisitionConflict("greenhouse", "R11622", "greenhouse", "See Opening ID")).toBe(false);
  });

  it("a missing id on either side says nothing", () => {
    expect(requisitionConflict("lever", null, "lever", "1079")).toBe(false);
    expect(requisitionConflict("lever", null, "lever", null)).toBe(false);
  });
});
