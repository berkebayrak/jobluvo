import { describe, expect, it } from "vitest";
import { costUsd, priceFor } from "@/server/llm/prices";
import { canonical, renderProfile } from "./profile";
import { bandOf, buildInput, jobBlock, JOB_TEXT_CHARS, LINE_CHARS, parseScore, type ScoringJob } from "./score";

const job: ScoringJob = {
  id: "j",
  title: "Strategy Lead",
  companyName: "Stripe",
  locations: [{ raw: "New York, NY", city: "New York", region: "NY", country: "US" }],
  workplace: "hybrid",
  employmentType: "Full time",
  seniority: "Lead",
  compRaw: "USD 175,000 to 215,000",
  compMin: 175000,
  compMax: 215000,
  compCurrency: "USD",
  compPeriod: "year",
  descriptionCore: "Own the planning cadence.",
  contentHash: "h",
};

describe("prompt order", () => {
  it("profile first sends the profile as its own message before the job, job first the reverse", () => {
    const a = buildInput("PROFILE", "JOB", "profile-first");
    const b = buildInput("PROFILE", "JOB", "job-first");
    expect(a).toEqual([
      { role: "developer", content: "PROFILE" },
      { role: "user", content: "JOB" },
    ]);
    expect(b.map((m) => m.content)).toEqual(["JOB", "PROFILE"]);
  });
  it("the job block carries the stated facts and cuts a long description with a marker", () => {
    const block = jobBlock(job);
    expect(block).toContain("Title: Strategy Lead");
    expect(block).toContain("Compensation: USD 175,000 to 215,000");
    expect(block).toContain("Level: Lead");
    const long = jobBlock({ ...job, descriptionCore: "x".repeat(JOB_TEXT_CHARS + 500) });
    expect(long).toContain("[truncated]");
    expect(long.length).toBeLessThan(JOB_TEXT_CHARS + 300);
  });
});

describe("bands and parsing", () => {
  it("bands at 75 and 55", () => {
    expect(bandOf(75)).toBe("strong");
    expect(bandOf(74)).toBe("good");
    expect(bandOf(55)).toBe("good");
    expect(bandOf(54)).toBe("weak");
  });
  it("clamps the line counts, prefixes against lines, strips exclamation marks and cuts at a word", () => {
    const words = "a ".repeat(70).trim();
    const p = parseScore(
      JSON.stringify({
        score: 71,
        for: ["One!", "Two.", "Three", "Four"],
        against: ["Gap — none", `${words} tail`, "Extra"],
        unknowns: ["Start date not stated", "Team size", "Third"],
      }),
    );
    expect(p.score).toBe(71);
    expect(p.band).toBe("good");
    expect(p.reasons).toEqual(["One", "Two", "Three", "- Gap none", `- ${"a ".repeat(45).trim()}`]);
    expect(p.reasons[4].length).toBeLessThanOrEqual(LINE_CHARS + 2);
    expect(p.unknowns).toEqual(["Start date not stated", "Team size"]);
  });
  it("refuses output that is not the schema", () => {
    expect(() => parseScore("not json")).toThrow(/not JSON/);
    expect(() => parseScore(JSON.stringify({ score: 120, for: [], against: [], unknowns: [] }))).toThrow(/schema/);
    expect(() => parseScore(JSON.stringify({ score: 50, for: "x" }))).toThrow(/schema/);
  });
});

describe("profile block and hashes", () => {
  it("canonical JSON ignores key order and undefined, so the same facts hash the same", () => {
    expect(canonical({ b: 1, a: [{ d: undefined, c: 2 }] })).toBe(canonical({ a: [{ c: 2 }], b: 1 }));
    expect(canonical({ a: 1 })).not.toBe(canonical({ a: 2 }));
  });
  it("renders every section with the profile's own words", () => {
    const block = renderProfile({
      prefs: { targetCountries: ["US"], relocation: "yes", remote: "remote_ok", employmentTypes: ["Full time"], earliestStart: "2026-11-01" },
      employment: [{ company: "Arvento", title: "Head of Strategy", start: "2022-03", bullets: ["Led a 3 year cost program."] }],
      education: [{ institution: "Koc University", degree: "MBA", end: "2020-06" }],
      skills: [{ name: "SQL", years: 6 }],
      answers: [{ question: "Salary expectation", answer: "USD 150,000 to 175,000 base" }],
    });
    expect(block.startsWith("CANDIDATE PROFILE")).toBe(true);
    expect(block).toContain("Wants to work in: US. Will relocate. Remote or on site.");
    expect(block).toContain("1. Head of Strategy, Arvento, 2022-03 to present");
    expect(block).toContain("   - Led a 3 year cost program.");
    expect(block).toContain("- MBA, Koc University, to 2020-06");
    expect(block).toContain("- SQL (6 years)");
    expect(block).toContain("- Salary expectation: USD 150,000 to 175,000 base");
  });
});

describe("cost meter", () => {
  it("bills cached input at the cached rate and refuses an unpriced model", () => {
    const fresh = costUsd("gpt-5.6-luna", { inputTokens: 2000, outputTokens: 100 });
    const cached = costUsd("gpt-5.6-luna", { inputTokens: 2000, cachedInputTokens: 1500, outputTokens: 100 });
    expect(fresh).toBeCloseTo((2000 * 0.2 + 100 * 1.2) / 1e6, 10);
    expect(cached).toBeCloseTo((500 * 0.2 + 1500 * 0.02 + 100 * 1.2) / 1e6, 10);
    expect(cached).toBeLessThan(fresh);
    expect(() => priceFor("gpt-5.6-nova")).toThrow(/No price entry/);
  });
});
