import { describe, expect, it } from "vitest";
import type { FeedJob } from "@/server/jobs/feed";
import { sponsorshipLine } from "./jobs-client";

const base = {
  id: "j",
  groupId: null,
  family: "greenhouse",
  companyName: "Ramp",
  companyDomain: "ramp.com",
  title: "Engagement Manager",
  locations: [],
  workplace: "unknown",
  employmentType: null,
  compMin: null,
  compMax: null,
  compCurrency: null,
  compPeriod: "unknown",
  seniority: null,
  sponsorship: "unknown",
  sponsorshipEvidence: null,
  eligibility: null,
  eligibilityEvidence: null,
  applyUrl: "https://example.com",
  postedAt: null,
  firstSeenAt: "2026-09-17T00:00:00.000Z",
  alsoOn: [],
  copies: 1,
  match: null,
} satisfies FeedJob;

const needs = { needsSponsorship: true };

describe("sponsorshipLine", () => {
  it("quotes a stated restriction, without the list dash the text came with", () => {
    const j = { ...base, eligibility: "right_to_work", eligibilityEvidence: "- Right to work in the UK is required." };
    expect(sponsorshipLine(j, needs)).toBe("- Posting states a restriction: Right to work in the UK is required.");
    expect(sponsorshipLine(j)).toBe("- Posting states a restriction: Right to work in the UK is required.");
  });
  it("treats a stated no to sponsorship as a restriction with its sentence", () => {
    const j = { ...base, sponsorship: "not_offered", sponsorshipEvidence: "We are unable to sponsor visas for this role." };
    expect(sponsorshipLine(j, needs)).toBe("- Posting states a restriction: We are unable to sponsor visas for this role.");
  });
  it("says the posting sponsors only when it says so", () => {
    expect(sponsorshipLine({ ...base, sponsorship: "offered" }, needs)).toBe("+ Posting says it sponsors");
  });
  it("shows quiet as quiet for someone who needs sponsorship, and nothing for someone who does not", () => {
    expect(sponsorshipLine(base, needs)).toBe("? Posting says nothing about sponsorship");
    expect(sponsorshipLine(base, { needsSponsorship: false })).toBeUndefined();
    expect(sponsorshipLine(base)).toBeUndefined();
  });
  it("cuts a long sentence at a word", () => {
    const long = "Candidates must have the right to work in Ireland by the start date and must be able to attend the Dublin office three days a week without exception.";
    const line = sponsorshipLine({ ...base, eligibility: "right_to_work", eligibilityEvidence: long }, needs)!;
    expect(line.length).toBeLessThan(160);
    expect(line.endsWith("…")).toBe(true);
  });
});
