import { describe, expect, it } from "vitest";
import { lockKey, normaliseApplyUrl } from "./identity";

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
