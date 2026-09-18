import { describe, expect, it } from "vitest";
import type { ResumeFacts } from "@/server/match/profile";
import { baseResume, factEntries } from "./resume";
import { readNumbers } from "./normalise";
import type { FactEntry } from "./resume";
import { checkLine, factSet, normaliseNumbers, validateChangeSet, valuesOf } from "./validate";

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
  it("is not fooled by words that are keys on Object.prototype", () => {
    expect(normaliseNumbers("Used constructor injection to simplify service testing")).toBe("used constructor injection to simplify service testing");
    expect(normaliseNumbers("wrote the toString method and valueOf")).toBe("wrote the tostring method and valueof");
    expect(normaliseNumbers("hasOwnProperty checks on three objects")).toBe("hasownproperty checks on 3 objects");
  });
  it("composes word numbers along the grammar only, never by adding neighbours", () => {
    expect(normaliseNumbers("three and five teams")).toBe("3 and 5 teams");
    expect(normaliseNumbers("five three teams")).toBe("5 3 teams");
    expect(normaliseNumbers("twenty twenty")).toBe("20 20");
    expect(normaliseNumbers("two hundred and five")).toBe("205");
    expect(normaliseNumbers("two hundred and twenty five people")).toBe("225 people");
    expect(normaliseNumbers("two hundred and more")).toBe("200 and more");
    expect(normaliseNumbers("a hundred and fifty")).toBe("a 150");
    expect(normaliseNumbers("two million five hundred thousand dollars")).toBe("2500000 dollars");
    expect(normaliseNumbers("one thousand two hundred")).toBe("1200");
    expect(normaliseNumbers("team of six.")).toBe("team of 6 .");
  });
  it("leaves a phrase the grammar cannot read as its words and reports it", () => {
    expect(readNumbers("five thousand two million")).toEqual({ text: "five thousand two million", unreadable: ["five thousand two million"] });
    expect(readNumbers("two million thousand dollars")).toEqual({ text: "two million thousand dollars", unreadable: ["two million thousand"] });
    expect(readNumbers("one million hundred")).toEqual({ text: "one million hundred", unreadable: ["one million hundred"] });
    expect(readNumbers("eight teams").unreadable).toEqual([]);
  });
  it("review four, finding 7: a tens word takes a units word under ten only, digits scale a hundred, every separator drops, and a sign stays", () => {
    expect(readNumbers("twenty ten teams")).toEqual({ text: "twenty ten teams", unreadable: ["twenty ten"] });
    expect(normaliseNumbers("2 hundred users")).toBe("200 users");
    expect(normaliseNumbers("1,234,567,890,123 rows")).toBe("1234567890123 rows");
    expect(normaliseNumbers("achieved -11 percent growth")).toBe("achieved -11 percent growth");
    expect(normaliseNumbers("USD 175k-215k")).toBe("usd 175000 215000");
    expect(normaliseNumbers("2019-2023")).toBe("2019 2023");
    expect(valuesOf("achieved -11 percent growth")).toEqual(new Set(["pct:-11"]));
    expect(valuesOf("constructor 2023")).toEqual(new Set(["year:2023"]));
    expect(valuesOf("toString 2023 and valueOf 2024")).toEqual(new Set(["year:2023", "year:2024"]));
    expect(valuesOf("a study of 2,000 customers")).toEqual(new Set(["num:2000"]));
    expect(valuesOf("joined in 2000")).toEqual(new Set(["year:2000"]));
    expect(valuesOf("in 2023 revenue grew 20 percent")).toEqual(new Set(["year:2023", "pct:20"]));
    expect(valuesOf("class of 2020")).toEqual(new Set(["year:2020"]));
    expect(valuesOf("Sep 2023 to Jan 2024")).toEqual(new Set(["date:2023-09", "date:2024-01"]));
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
  it("holds a line with a number phrase it could not read, and a value checked against a fact with one", () => {
    const entry = (id: string, text: string): FactEntry => ({ id, text, kind: "employment", role: "R1", source: FROM_RESUME });
    const odd = factSet([entry("R1", "Head of Strategy, Arvento"), entry("R1.1", "Raised five thousand two million dollars for the fund."), entry("R1.2", "Managed three and five teams.")]);
    // The fact's own phrase is unreadable: a value on the line is held, not rejected, because the fact may hold it.
    expect(checkLine("Raised 2 billion dollars for the fund.", "R1.1", ["R1.1"], odd).map((f) => [f.level, f.message])).toEqual([
      ["review", "value could not be checked; a cited fact has a number phrase that could not be read"],
    ]);
    // Against a readable fact the same value is hard as before.
    expect(checkLine("Raised 2 billion dollars for the fund.", "R1.1", ["R1.2"], odd).map((f) => f.level)).toEqual(["hard"]);
    // "three and five" is 3 and 5: 8 is an invention and is rejected, not a sum.
    expect(checkLine("Managed 8 teams.", "R1.2", ["R1.2"], odd).map((f) => [f.level, f.value])).toEqual([["hard", "num:8"]]);
    expect(checkLine("Managed 3 and 5 teams.", "R1.2", ["R1.2"], odd)).toEqual([]);
    // The line's own phrase is unreadable: held.
    expect(checkLine("Raised five thousand two million dollars.", "R1.1", ["R1.2"], odd).map((f) => [f.level, f.value])).toEqual([["review", "five thousand two million"]]);
    // A word the tables do not know but Object.prototype does is a word.
    expect(checkLine("Used constructor injection across the teams.", "R1.2", ["R1.2"], odd).filter((f) => f.level !== "soft")).toEqual([]);
  });

  it("a citation that does not exist holds the line, and so does a line that cites nothing", () => {
    // With nothing real cited, the object "system" has no fact to be in either: two holds, both named.
    expect(review("Led the OKR system", ["R9.9"])).toEqual([
      expect.objectContaining({ message: "cited fact does not exist", value: "R9.9" }),
      expect.objectContaining({ message: "responsibility is not in the cited facts", value: "system", detail: "the cited facts name no object for it" }),
    ]);
    expect(hard("Led the OKR system", ["R9.9"])).toEqual([]);
    expect(review("Led the OKR system", []).map((f) => f.message)).toEqual(["no fact cited for this line", "responsibility is not in the cited facts"]);
    expect(review("Led the OKR system", ["R1.3"])).toEqual([]);
  });
  it("holds a new entity or responsibility for review, passes a rewording, and no longer reads a capitalised verb as a name", () => {
    // Every name in the line is on the profile, and the verb that opens it is a verb, not a name: nothing held, nothing soft (D-022 supersedes the D-017 soft class).
    expect(review("Reported to the CEO at Arvento using Power BI")).toEqual([]);
    expect(soft("Reported to the CEO at Arvento using Power BI")).toEqual([]);
    // A tool in no fact is held; so is a responsibility the cited facts do not name, with the word the cited fact uses in its place.
    expect(review("Led migration to Salesforce for the Deloitte team")).toEqual([
      expect.objectContaining({ message: "responsibility is not in the cited facts", value: "migration", detail: "the cited fact says strategy" }),
      expect.objectContaining({ message: "name appears in no confirmed fact", value: "Salesforce", detail: "capitalised" }),
    ]);
    expect(review("Built reporting in Excel, Power BI for the PMOs")).toEqual([]);
    // Words are looked up one at a time: two known words side by side pass. The old run rule held "Power Excel"; the entity rule does not.
    expect(review("Built reporting in Power Excel")).toEqual([]);
    // An acronym in no fact is held by its form; the verb that opens the line is not a name.
    expect(review("Owned the KPI framework").map((f) => [f.value, f.detail])).toEqual([
      ["framework", "the cited fact says strategy"],
      ["KPI", "by its form"],
    ]);
    expect(soft("Owned the KPI framework")).toEqual([]);
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
    // "Leader" opens the sentence, is not a verb and is on no fact: held (D-022). Citing nothing is itself held.
    expect(unc.map((f) => [f.level, f.bullet, f.message])).toEqual([
      ["review", "summary", "no fact cited for this line"],
      ["hard", "summary", "value with no fact cited for it"],
      ["review", "summary", "name appears in no confirmed fact"],
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
