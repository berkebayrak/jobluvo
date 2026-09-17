import { describe, expect, it } from "vitest";
import type { ResumeFacts } from "@/server/match/profile";
import { applyChanges, applyDocument, baseResume, factEntries, renderResume, resumeHash } from "./resume";

const FACTS: ResumeFacts = {
  userId: "u",
  prefs: { targetCountries: ["US"], relocation: "yes", remote: "remote_ok" },
  employment: [
    { company: "Arvento", title: "Head of Strategy", location: "Istanbul, Turkey", start: "2022-03", bullets: ["Led a 3 year cost program.", "Own the annual planning cycle."] },
    { company: "Deloitte", title: "Consultant", start: "2019-06", end: "2022-02", bullets: ["Delivered 9 projects."] },
  ],
  education: [{ institution: "Koc University", degree: "MBA", end: "2020-06" }],
  skills: [
    { name: "Strategy", years: 8 },
    { name: "SQL", years: 6 },
    { name: "Pricing" },
  ],
  answers: [{ question: "Salary expectation", answer: "USD 150,000" }],
  prefsHash: "p",
  factsHash: "f",
};

describe("facts and the base resume", () => {
  it("numbers every fact so the model can cite it and the validator can find it", () => {
    expect(factEntries(FACTS).map((e) => e.id)).toEqual(["R1", "R1.1", "R1.2", "R2", "R2.1", "E1", "S1", "S2", "S3"]);
    // The salary answer is not on the resume and cannot be cited.
    expect(factEntries(FACTS).some((e) => e.text.includes("150,000"))).toBe(false);
    expect(factEntries(FACTS).find((e) => e.id === "R1")!.text).toBe("Head of Strategy, Arvento, Istanbul, Turkey, 2022-03 to present");
    expect(factEntries(FACTS).find((e) => e.id === "S1")!.text).toBe("Strategy (8 years)");
  });
  it("the base document is the facts in their own order with no summary", () => {
    const base = baseResume(FACTS);
    expect(base.summary).toBeNull();
    expect(base.experience[0].bullets.map((b) => b.id)).toEqual(["R1.1", "R1.2"]);
    expect(base.skills.map((s) => s.text)).toEqual(["Strategy", "SQL", "Pricing"]);
  });
});

describe("applying a change set", () => {
  const base = baseResume(FACTS);
  it("replaces named lines, adds the summary, orders skills, and the diff is the change set", () => {
    const { resume, diff, dropped } = applyChanges(base, {
      summary: "Strategy leader.",
      summaryFacts: ["R1"],
      changes: [
        { bullet: "R1.2", text: "Own the annual planning cycle with finance.", facts: ["R1.2"] },
        { bullet: "R1.2", text: "Own the annual planning cycle with finance.", facts: ["R1.2"] },
        { bullet: "R9.1", text: "Nothing", facts: [] },
      ],
      skills: ["S3", "S3", "S9"],
    });
    expect(resume.summary).toBe("Strategy leader.");
    expect(resume.experience[0].bullets[1].text).toBe("Own the annual planning cycle with finance.");
    expect(resume.experience[0].bullets[0].text).toBe("Led a 3 year cost program.");
    expect(resume.skills.map((s) => s.id)).toEqual(["S3", "S1", "S2"]);
    expect(dropped).toEqual([{ bullet: "R9.1", text: "Nothing", facts: [] }]);
    expect(diff).toEqual([
      { bullet: "summary", before: "", after: "Strategy leader.", facts: ["R1"] },
      { bullet: "R1.2", before: "Own the annual planning cycle.", after: "Own the annual planning cycle with finance.", facts: ["R1.2"] },
    ]);
    // The base is untouched and the hash follows the content.
    expect(base.summary).toBeNull();
    expect(resumeHash(resume)).not.toBe(resumeHash(base));
    expect(resumeHash(applyChanges(base, { summary: null, summaryFacts: [], changes: [], skills: [] }).resume)).toBe(resumeHash(base));
  });
  it("a whole document answer is reconciled onto the base by role and position, and its diff is only what changed", () => {
    const { resume, diff } = applyDocument(base, {
      summary: null,
      experience: [
        { id: "R1", bullets: ["Led a 3 year cost program.", "Ran the annual planning cycle."] },
        { id: "R2", bullets: ["Delivered 9 projects."] },
        { id: "R5", bullets: ["Invented"] },
      ],
      skills: ["sql", "Strategy"],
    });
    expect(diff).toEqual([{ bullet: "R1.2", before: "Own the annual planning cycle.", after: "Ran the annual planning cycle.", facts: ["R1.2"] }]);
    expect(resume.experience).toHaveLength(2);
    expect(resume.skills.map((s) => s.id)).toEqual(["S2", "S1", "S3"]);
  });
  it("renders a plain document", () => {
    const text = renderResume("Jack Miller", applyChanges(base, { summary: "Strategy leader.", summaryFacts: [], changes: [], skills: [] }).resume);
    expect(text.split("\n").slice(0, 5)).toEqual(["Jack Miller", "", "Strategy leader.", "", "Experience"]);
    expect(text).toContain("- Led a 3 year cost program.");
    expect(text.endsWith("Skills\nStrategy, SQL, Pricing")).toBe(true);
  });
});
