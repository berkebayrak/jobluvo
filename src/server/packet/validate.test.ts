import { describe, expect, it } from "vitest";
import type { ResumeFacts } from "@/server/match/profile";
import { baseResume, factEntries } from "./resume";
import { checkLine, factSet, namesOf, normaliseNumbers, validateChangeSet, valuesOf } from "./validate";

/*
 * The validator against deliberate near misses. Every rejection here is a
 * line a model could plausibly write, and every pass is a rephrasing a
 * person would call the same fact. A validator that passes everything is
 * worse than none, so the rejections matter more than the passes.
 */

const FROM_RESUME = { rowId: "row", origin: "upload" as const, hasEvidence: true };

const FACTS: ResumeFacts = {
  userId: "u",
  prefs: { targetCountries: ["US"], relocation: "yes", remote: "remote_ok", employmentTypes: ["Full time"], earliestStart: "2026-11-01" },
  employment: [
    {
      company: "Arvento",
      title: "Head of Strategy and PMO",
      location: "Istanbul, Turkey",
      start: "2022-03",
      bullets: [
        "Lead the strategy and PMO function for a telematics company with USD 140M revenue, reporting to the CEO, with a team of four strategy managers and two analysts.",
        "Designed and ran a 3 year cost transformation program across 4 business units that reduced operating cost by 11 percent (USD 9.2M a year) against a 12 percent target.",
        "Built the company OKR system from scratch in 2023, now used by 38 teams.",
        "Screened 14 acquisition targets and prepared the investment case for the one that closed in 2024 (USD 18M).",
      ],
    },
    {
      company: "Deloitte Turkey",
      title: "Senior Strategy Consultant",
      start: "2019-06",
      end: "2022-02",
      bullets: ["Led the market entry study for a regional bank's SME lending product: sized a USD 1.1B addressable market."],
    },
  ],
  education: [{ institution: "Koc University", degree: "MBA", start: "2018-09", end: "2020-06" }],
  skills: [
    { name: "Financial modelling", years: 10 },
    { name: "Power BI and Excel", years: 10 },
  ],
  answers: [{ question: "Salary expectation", answer: "USD 150,000 to 175,000 base" }],
  sources: { employment: [FROM_RESUME, FROM_RESUME], education: [FROM_RESUME], skills: [FROM_RESUME, FROM_RESUME] },
  prefsHash: "p",
  factsHash: "f",
};

const set = factSet(factEntries(FACTS));
const ALL = ["R1", "R1.1", "R1.2", "R1.3", "R1.4", "E1", "S1", "S2"];
/** Hard findings for an R1 line that cites every fact it may (R2's facts belong to another role), so only values that are nowhere on the profile fail. */
const hard = (line: string, cited: string[] = ALL) => checkLine(line, "R1.1", cited, set).filter((f) => f.level === "hard");
const soft = (line: string, cited: string[] = ALL) => checkLine(line, "R1.1", cited, set).filter((f) => f.level === "soft");
const review = (line: string, cited: string[] = ALL) => checkLine(line, "R1.1", cited, set).filter((f) => f.level === "review");

describe("normaliser", () => {
  it("writes word numbers, suffixes, separators and hyphens the same way", () => {
    expect(normaliseNumbers("eight teams")).toBe("8 teams");
    expect(normaliseNumbers("twenty five people")).toBe("25 people");
    expect(normaliseNumbers("USD 2.3 million")).toBe("usd 2300000");
    expect(normaliseNumbers("USD 2.3M and 400k users")).toBe("usd 2300000 and 400000 users");
    expect(normaliseNumbers("a 3-year program")).toBe("a 3 year program");
    expect(normaliseNumbers("three-year program")).toBe("3 year program");
    expect(normaliseNumbers("150,000 to 175,000")).toBe("150000 to 175000");
    expect(normaliseNumbers("two million subscribers")).toBe("2000000 subscribers");
  });
  it("reads dates, percentages and money into one form each", () => {
    expect(valuesOf("Jan 2023")).toEqual(new Set(["date:2023-01"]));
    expect(valuesOf("January 2023")).toEqual(new Set(["date:2023-01"]));
    expect(valuesOf("2023-01")).toEqual(new Set(["date:2023-01"]));
    expect(valuesOf("11 percent")).toEqual(new Set(["pct:11"]));
    expect(valuesOf("11%")).toEqual(new Set(["pct:11"]));
    expect(valuesOf("USD 9.2M")).toEqual(new Set(["money:usd:9200000"]));
    expect(valuesOf("$9.2 million")).toEqual(new Set(["money:usd:9200000"]));
    expect(valuesOf("in 2024")).toEqual(new Set(["year:2024"]));
  });
});

describe("hard rejections: a value in no confirmed fact", () => {
  it("passes the fact's own words and their plain restatements", () => {
    expect(hard("Cut operating cost 11% (USD 9.2 million a year) across four business units in a three year program")).toEqual([]);
    expect(hard("Reduced cost by eleven percent against a twelve percent target")).toEqual([]);
    expect(hard("Four managers and two analysts, at a USD 140 million telematics company")).toEqual([]);
    expect(hard("Built an OKR system used by 38 teams since 2023")).toEqual([]);
    expect(hard("Closed a USD 18M acquisition in 2024 after screening 14 targets")).toEqual([]);
    // The market size is Deloitte's fact: cited under its own role it passes; under R1 it would cite another role.
    expect(checkLine("Sized a $1.1B market for SME lending", "R2.1", ["R2.1"], set).filter((f) => f.level === "hard")).toEqual([]);
    expect(hard("Head of Strategy since March 2022")).toEqual([]);
  });
  it("rejects a number, amount, percentage or date that is not on the profile", () => {
    expect(hard("Reduced operating cost by 13 percent")).toEqual([expect.objectContaining({ level: "hard", value: "pct:13" })]);
    expect(hard("Saved USD 9.4M a year")).toEqual([expect.objectContaining({ value: "money:usd:9400000" })]);
    expect(hard("Saved EUR 9.2M a year")).toEqual([expect.objectContaining({ value: "money:eur:9200000" })]);
    expect(hard("Program across five business units")).toEqual([expect.objectContaining({ value: "num:5" })]);
    expect(hard("Built the OKR system in January 2023")).toEqual([expect.objectContaining({ value: "date:2023-01" })]);
    expect(hard("Joined Arvento in 2021")).toEqual([expect.objectContaining({ value: "year:2021" })]);
    expect(hard("Team of seventeen")).toEqual([expect.objectContaining({ value: "num:17" })]);
    // Arithmetic over facts is a new claim: four managers and two analysts is not "a team of 6" on the profile.
    expect(hard("Team of 6 across strategy and analysis")).toEqual([expect.objectContaining({ value: "num:6" })]);
    expect(hard("Managed a USD 250M budget")).toEqual([expect.objectContaining({ value: "money:usd:250000000" })]);
    // The salary expectation is an answer, not resume content: its figure is not on the resume's fact set at all.
    expect(hard("Expects USD 150,000 base")).toEqual([expect.objectContaining({ value: "money:usd:150000" })]);
  });
  it("rejects a rounded or rescaled figure, because it is a different claim", () => {
    expect(hard("USD 9M in savings")).toHaveLength(1);
    expect(hard("about 10 percent lower cost")).toEqual([expect.objectContaining({ value: "pct:10" })]);
    expect(hard("nearly 40 teams")).toEqual([expect.objectContaining({ value: "num:40" })]);
  });
});

describe("a value must be in a cited fact", () => {
  it("passes a value the cited fact carries, rejects one that is only elsewhere on the profile, and one with nothing cited", () => {
    expect(hard("Reduced cost 11 percent", ["R1.2"])).toEqual([]);
    // 11 percent is on the profile, in R1.2, but the edit cites R1.1: rejected.
    expect(hard("Reduced cost 11 percent", ["R1.1"])).toEqual([expect.objectContaining({ level: "hard", message: "value is on the profile but not in the cited facts", value: "pct:11" })]);
    // Four managers and two analysts are in R1.1; "six" is on the profile only as coached 6 analysts, elsewhere.
    expect(hard("Managing six strategy professionals", ["R1.1"])).toEqual([expect.objectContaining({ level: "hard", value: "num:6" })]);
    expect(hard("Reduced cost 11 percent", [])).toEqual([expect.objectContaining({ level: "hard", message: "value with no fact cited for it", value: "pct:11" })]);
    // A line with no value needs no citation.
    expect(hard("Led the planning cycle with finance", [])).toEqual([]);
  });
  it("a citation that does not exist is soft, on its own", () => {
    expect(soft("Led the planning cycle", ["R9.9"])).toEqual([expect.objectContaining({ message: "cited fact does not exist", value: "R9.9" })]);
  });
  it("holds a name that appears in no fact for review, and passes the names that do", () => {
    // Every name in the line is on the profile; the verb that opens it is not, and a sentence initial miss is soft: measured at 12 of 12 false positives (D-017).
    expect(review("Reported to the CEO at Arvento using Power BI")).toEqual([]);
    expect(soft("Reported to the CEO at Arvento using Power BI")).toEqual([expect.objectContaining({ value: "Reported", detail: "sentence initial" })]);
    expect(review("Led migration to Salesforce for the Deloitte team")).toEqual([expect.objectContaining({ message: "name appears in no confirmed fact", value: "Salesforce" })]);
    expect(namesOf("Built dashboards in Power BI. Reported to the CFO monthly.")).toEqual(["Power BI", "CFO"]);
    // A comma ends a name, so a list of known names is several known names; a plural of a known name is known.
    expect(namesOf("Skills in Excel, Power BI, and financial modelling.")).toEqual(["Excel", "Power BI"]);
    expect(review("Built reporting in Excel, Power BI for the PMOs")).toEqual([]);
    // Two known words run together are not a known name, and a new acronym is not either.
    expect(review("Built reporting in Power Excel")).toEqual([expect.objectContaining({ value: "Power Excel" })]);
    expect(review("Owned the KPI framework")).toEqual([expect.objectContaining({ value: "KPI" })]);
    expect(soft("Owned the KPI framework")).toEqual([expect.objectContaining({ value: "Owned", detail: "sentence initial" })]);
  });
});

describe("change set validation", () => {
  const base = baseResume(FACTS);
  it("accepts a set of true edits and rejects the one invented value among them", () => {
    const good = validateChangeSet(
      {
        summary: "Strategy leader with 10 years in planning, cost transformation and M&A.",
        summaryFacts: ["S1"],
        changes: [{ bullet: "R1.2", text: "Ran a 3 year cost program across 4 business units, cutting operating cost 11 percent, USD 9.2M a year.", facts: ["R1.2"] }],
        skills: ["S1"],
      },
      base,
      set,
    );
    expect(good.filter((f) => f.level === "hard")).toEqual([]);
    const bad = validateChangeSet(
      { summary: null, summaryFacts: [], changes: [{ bullet: "R1.2", text: "Cut operating cost 15 percent in an 18 month program.", facts: ["R1.2"] }], skills: [] },
      base,
      set,
    );
    expect(bad.filter((f) => f.level === "hard").map((f) => f.value).sort()).toEqual(["num:18", "pct:15"]);
    // A summary with a value and no citation is rejected like any line.
    const unc = validateChangeSet({ summary: "Leader with 10 years of experience.", summaryFacts: [], changes: [], skills: [] }, base, set);
    // "Leader" opens the sentence and is on no fact: soft, it travels with the packet (D-017).
    expect(unc.map((f) => [f.level, f.bullet, f.message])).toEqual([
      ["hard", "summary", "value with no fact cited for it"],
      ["soft", "summary", "name appears in no confirmed fact"],
    ]);
  });
  it("reports an edit to a line that does not exist and a skill that does not exist as soft, never as a pass", () => {
    const f = validateChangeSet({ summary: null, summaryFacts: [], changes: [{ bullet: "R7.1", text: "Anything", facts: [] }], skills: ["S9"] }, base, set);
    expect(f.map((x) => [x.level, x.message])).toEqual([
      ["soft", "no such line on the resume; edit dropped"],
      ["soft", "no such skill; ignored"],
    ]);
  });
});
