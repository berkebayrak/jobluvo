import { describe, expect, it } from "vitest";
import type { ResumeFacts } from "@/server/match/profile";
import { baseResume, factEntries } from "./resume";
import { readNumbers } from "./normalise";
import type { FactEntry } from "./resume";
import { claimsOf } from "./claims";
import { actionable, checkLine, factSet, normaliseNumbers, validateChangeSet, valuesOf } from "./validate";

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
    expect(readNumbers("five thousand two million")).toEqual({ text: "five thousand two million", unreadable: ["five thousand two million"], unreadableSpans: [[0, 25]] });
    expect(readNumbers("two million thousand dollars")).toEqual({ text: "two million thousand dollars", unreadable: ["two million thousand"], unreadableSpans: [[0, 20]] });
    expect(readNumbers("one million hundred")).toEqual({ text: "one million hundred", unreadable: ["one million hundred"], unreadableSpans: [[0, 19]] });
    expect(readNumbers("eight teams").unreadable).toEqual([]);
    expect(readNumbers("eight teams").unreadableSpans).toEqual([]);
  });
  it("review four, finding 7: a tens word takes a units word under ten only, digits scale a hundred, every separator drops, and a sign stays", () => {
    expect(readNumbers("twenty ten teams")).toEqual({ text: "twenty ten teams", unreadable: ["twenty ten"], unreadableSpans: [[0, 10]] });
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
    expect(hard("Reduced operating cost 11% (USD 9.2 million a year) across four business units in a three year program")).toEqual([]);
    expect(hard("Reduced cost by eleven percent against a twelve percent target")).toEqual([]);
    // "Four" opens the line and reads as a name, the false positive recorded below; written the way a tailored line would be, it passes.
    expect(hard("Led four managers and two analysts, at a USD 140 million telematics company")).toEqual([]);
    expect(hard("Built an OKR system used by 38 teams since 2023")).toEqual([]);
    expect(hard("Prepared the USD 18M acquisition case in 2024 after screening 14 targets")).toEqual([]);
    expect(checkLine("Sized a $1.1B market for SME lending", "R2.1", ["R2.1"], set).filter((f) => f.level === "hard")).toEqual([]);
    expect(hard("Head of Strategy since March 2022")).toEqual([]);
  });
  it("rejects a number, amount, percentage or date that is not on the profile", () => {
    expect(hard("Reduced operating cost by 13 percent")).toEqual([expect.objectContaining({ level: "hard", value: "pct:13" })]);
    expect(hard("Saved USD 9.4M a year").map((f) => f.value)).toEqual(["money:usd:9400000"]);
    expect(hard("Saved EUR 9.2M a year").map((f) => f.value)).toEqual(["money:eur:9200000"]);
    expect(hard("Ran a program across five business units").map((f) => f.value)).toEqual(["num:5"]);
    expect(hard("Built the OKR system in January 2023").map((f) => f.value)).toEqual(["date:2023-01"]);
    expect(hard("Joined Arvento in 2021").map((f) => f.value)).toEqual(["year:2021"]);
    expect(hard("Managed a team of seventeen").map((f) => f.value)).toEqual(["num:17"]);
    // Arithmetic over facts is a new claim: four managers and two analysts is not "a team of 6" on the profile.
    expect(hard("Managed a team of 6 across strategy and analysis").map((f) => f.value)).toEqual(["num:6"]);
    expect(hard("Managed a USD 250M budget").map((f) => f.value)).toEqual(["money:usd:250000000"]);
    // The salary expectation is an answer, not resume content: its figure is not on the resume's fact set at all.
    // "Expects" also reads as a name, the false positive below; the figure is what this asserts.
    expect(hard("Expects USD 150,000 base").map((f) => f.value)).toContain("money:usd:150000");
  });
  it("rejects a rounded or rescaled figure, because it is a different claim", () => {
    expect(hard("Delivered USD 9M in savings").map((f) => f.value)).toEqual(["money:usd:9000000"]);
    expect(hard("Delivered about 10 percent lower cost").map((f) => f.value)).toEqual(["pct:10"]);
    expect(hard("Built a system used by nearly 40 teams").map((f) => f.value)).toEqual(["num:40"]);
  });
});

/*
 * The cited fact comparison is gone (D-034), and with it every test that
 * asked whether a value belonged to the fact the line pointed at. What
 * follows is the lookup that replaced it, profile wide, and the two things
 * kept beside it that are not comparisons.
 */
describe("the lookup is profile wide, not against the cited facts", () => {
  it("passes a value that is anywhere on the profile, whatever the line cites or fails to cite", () => {
    // 11 percent is R1.2's. Citing R1.1 instead was hard before; a citation is no longer what a value is checked against.
    expect(hard("Reduced cost 11 percent", ["R1.1"])).toEqual([]);
    expect(hard("Reduced cost 11 percent", ["R1.2"])).toEqual([]);
    expect(hard("Reduced cost 11 percent", [])).toEqual([]);
    // R2's USD 1.1B on an R1 line: the employer rule held this, and nothing does now.
    expect(hard("Sized a USD 1.1B market", ["R1.1"])).toEqual([]);
  });

  it("a citation that names nothing, or names a fact that does not exist, is held and never rejected", () => {
    expect(review("Led the OKR system", ["R9.9"]).map((f) => [f.message, f.value])).toEqual([["cited fact does not exist", "R9.9"]]);
    expect(hard("Led the OKR system", ["R9.9"])).toEqual([]);
    expect(review("Led the OKR system", []).map((f) => f.message)).toEqual(["no fact cited for this line"]);
    expect(review("Led the OKR system", ["R1.3"])).toEqual([]);
  });

  it("holds a line with a number phrase it could not read, because the lookup did not run on it", () => {
    const entry = (id: string, text: string): FactEntry => ({ id, text, kind: "employment", role: "R1", source: FROM_RESUME });
    const odd = factSet([entry("R1", "Head of Strategy, Arvento"), entry("R1.1", "Raised five thousand two million dollars for the fund."), entry("R1.2", "Managed three and five teams.")]);
    expect(checkLine("Raised five thousand two million dollars.", "R1.1", ["R1.2"], odd).map((f) => [f.level, f.value])).toEqual([["review", "five thousand two million"]]);
    // "three and five" is 3 and 5, so 8 is an invention and the finding is still raised. Its LEVEL changed with
    // D-040 and this is the price of that rule, stated rather than hidden: this profile carries a number phrase
    // nothing could read, so no absence of a match on it is certain, and an invention on it is held for a person
    // instead of rejected. The same line on a profile whose numbers all read is still rejected, asserted below.
    expect(checkLine("Managed 8 teams.", "R1.2", ["R1.2"], odd).map((f) => [f.level, f.value])).toEqual([["review", "num:8"]]);
    const readable = factSet([entry("R1", "Head of Strategy, Arvento"), entry("R1.2", "Managed 3 and 5 teams.")]);
    expect(checkLine("Managed 8 teams.", "R1.2", ["R1.2"], readable).map((f) => [f.level, f.value])).toEqual([["hard", "num:8"]]);
    expect(checkLine("Managed 3 and 5 teams.", "R1.2", ["R1.2"], odd)).toEqual([]);
    // A word the tables do not know but Object.prototype does is a word.
    expect(checkLine("Used constructor injection across the teams.", "R1.2", ["R1.2"], odd).filter((f) => f.level !== "soft")).toEqual([]);
  });

  it("holds a name in no confirmed fact rather than rejecting it, and passes one the profile has under any role", () => {
    // A name is a guess about a word's shape, so it holds the packet and keeps the resume (D-036).
    expect(hard("Led migration to Salesforce for the Deloitte team")).toEqual([]);
    expect(review("Led migration to Salesforce for the Deloitte team").map((f) => [f.message, f.value])).toEqual([["name appears in no confirmed fact", "Salesforce"]]);
    expect(hard("Owned the KPI framework")).toEqual([]);
    expect(review("Owned the KPI framework").map((f) => f.value)).toEqual(["KPI"]);
    // Every name on the profile, wherever it sits: nothing fires.
    expect(checkLine("Reported to the CEO at Arvento using Power BI", "R1.1", ALL, set)).toEqual([]);
    expect(hard("Built reporting in Excel, Power BI for the PMOs")).toEqual([]);
    expect(hard("Built reporting in Power Excel")).toEqual([]);
  });

  it("a capitalised word at the start that is not in the verb list reads as a name, and holds rather than rejects", () => {
    // "Oversight" opens the line, is not a verb, and the profile has "oversaw" rather than the noun, so a lemma lookup
    // does not find it. No list closes this, which is precisely why the finding may not destroy the work: it holds the
    // packet, the resume is kept and a person reads it (D-036). This example is the one that decided the level.
    expect(review("Oversight of four managers and two analysts").map((f) => f.value)).toEqual(["Oversight"]);
    expect(hard("Oversight of four managers and two analysts")).toEqual([]);
    // The same claim opened by a verb the list knows is not flagged at all.
    expect(review("Oversaw four managers and two analysts")).toEqual([]);
  });
});

describe("a span the normaliser could not read supplies no value at all", () => {
  /*
   * The seventh review's finding 4, reproduced before the fix. A span was marked uncertain and then read anyway:
   * "Raised USD 9,2 million" reported "9,2 million" as unreadable and still produced money:usd:9 and num:2000000.
   * Two figures nobody wrote, arriving as confirmed evidence on the fact side and as fabrications on the line side.
   * Marking a span and harvesting it is worse than either alone. Finding 5 is the same defect on the generated
   * side: a hard value-unknown derived from a span the parser could not read.
   */

  const entry = (id: string, text: string): FactEntry => ({ id, text, kind: "employment", role: "R1", source: FROM_RESUME });

  it("emits no claim from a decimal comma span, and none from a word number the grammar could not read", () => {
    expect(claimsOf("Raised USD 9,2 million in Series B").map((c) => c.key)).toEqual([]);
    expect(claimsOf("Grew revenue five thousand two million").map((c) => c.key)).toEqual([]);
    // The same text written unambiguously is read as usual.
    expect(claimsOf("Raised USD 9.2 million in Series B").map((c) => c.key)).toEqual(["money:usd:9200000"]);
  });

  it("emits nothing from an ambiguous comma whose digits the rewrite consumed", () => {
    /*
     * The eighth review's finding 5, reproduced before the fix. The spans are rediscovered from the rewritten
     * text, and the rewrite can eat the characters they covered: "9,2 hundred hundred" leaves "9,hundred hundred",
     * the digit comma digit run is gone, and "usd 9" came out as a confirmed amount nobody wrote.
     *
     * A focused regression rather than a wider grammar, on the user's instruction. The class is not closed:
     * carrying offsets through the rewrite is phase 1 work (D-053).
     */
    expect(claimsOf("Raised USD 9,2 hundred hundred and cut costs 40 percent").map((c) => c.key)).toEqual(["pct:40"]);
    expect(claimsOf("Raised USD 9,2 hundred hundred").map((c) => c.key)).toEqual([]);
    // A comma that is punctuation between numbers keeps every one of them. The space is what tells them apart.
    expect(claimsOf("Managed 4, 5 and 6 teams").map((c) => c.key)).toEqual(["num:4", "num:5", "num:6"]);
    expect(claimsOf("USD 150,000 to 175,000").map((c) => c.key)).toEqual(["money:usd:150000", "num:175000"]);
  });

  it("reads every other number in the same text, so one bad span does not silence a fact", () => {
    expect(claimsOf("Cut costs 11 percent and raised USD 9,2 million").map((c) => c.key)).toEqual(["pct:11"]);
    expect(claimsOf("Joined in twenty ten and managed 6 analysts").map((c) => c.key)).toEqual(["num:6"]);
    // A genuine thousands separator is not a span at all and is read normally.
    expect(claimsOf("a study of 2,000 customers that lifted ARPU 6 percent").map((c) => c.key)).toEqual(["num:2000", "pct:6"]);
  });

  it("the intended amount is held when its source is ambiguous, rather than rejected", () => {
    // The fact carries the ambiguous amount; the line states it cleanly. The line's value matches nothing, and
    // D-040 holds it because the profile carries an unreadable phrase. It is not a fabrication and is not rejected.
    const facts = factSet([entry("R1.1", "Raised USD 9,2 million in Series B."), entry("R1.2", "Closed 3 rounds.")]);
    const found = checkLine("Raised USD 9.2 million in Series B.", "R1.1", ["R1.1"], facts).filter((f) => f.code === "value-unknown");
    expect(found.map((f) => f.level)).toEqual(["review"]);
  });

  it("the fragments from that source do not pass as confirmed values", () => {
    // This is the half that matters most. Before the fix the fact below contributed money:usd:9 and num:2000000, so
    // a line inventing either of them was waved through as supported by the profile. Both are unknown now.
    const facts = factSet([entry("R1.1", "Raised USD 9,2 million in Series B."), entry("R1.2", "Closed 3 rounds.")]);
    // The evidence itself: the profile carries one value, and neither fragment is on it. This assertion is what
    // catches the pollution, and it is the one the eighth review confirmed was doing its job (finding 10).
    expect(facts.all.map((c) => c.key)).toEqual(["num:3"]);
    // "Raised USD 9 million" was the wrong example: it parses to money:usd:9000000, which is not the fragment the
    // bug produced, so it tested nothing about this. The fragment was money:usd:9, and "Raised USD 9." is how a
    // line states it (finding 10).
    expect(claimsOf("Raised USD 9.").map((c) => c.key)).toEqual(["money:usd:9"]);
    expect(claimsOf("Raised USD 9 million.").map((c) => c.key)).toEqual(["money:usd:9000000"]);
    for (const invented of ["Raised USD 9.", "Served 2000000 customers."]) {
      const found = checkLine(invented, "R1.1", ["R1.1"], facts).filter((f) => f.code === "value-unknown");
      expect(found.length).toBeGreaterThan(0);
    }
  });

  it("finding 5: no hard value-unknown is derived from a span the parser could not read, and other values on the line still are", () => {
    // A clean profile, so D-040's demotion is not what is doing the work here: the line's own bad span simply
    // produces no claim to reject. The readable invention beside it is still rejected.
    const clean = factSet([entry("R1.1", "Cut costs 11 percent."), entry("R1.2", "Managed 6 analysts.")]);
    expect(clean.unreadablePhrases).toEqual([]);
    const found = checkLine("Raised USD 9,2 million and cut costs 40 percent.", "R1.1", ["R1.1"], clean);
    // Nothing hard from the ambiguous amount; the line is held because the lookup never ran on that phrase.
    expect(found.filter((f) => f.code === "value-unknown").map((f) => [f.level, f.value])).toEqual([["hard", "pct:40"]]);
    expect(found.filter((f) => f.code === "number-unreadable").map((f) => f.value)).toEqual(["9,2 million"]);
  });
});

describe("a numeric span is either interpreted and checked, or reported as uninterpretable", () => {
  /*
   * The ninth review's finding 1, reproduced before the fix, and the whole class rather than the one input.
   *
   * D-053 added a pattern for a digit, a comma and any non space, to find the wreckage an ambiguous comma leaves
   * when the rewrite eats the digits after it. It matched far more than that: any comma with no space after it,
   * "in 2023,we launched" and "USD 99,then". Those values were suppressed from the claims and **no phrase was
   * reported**, so the text still read as fully readable.
   *
   * That is not a lost value, it is a rejection. The suppressed value is gone from the fact side, so a later
   * truthful line stating the same number matches nothing; and with no unreadable phrase on the profile, D-040's
   * guard has no reason to hold, so `value-unknown` is hard and the packet is rejected. A truthful line destroyed
   * by a missing space after a comma, which is the failure mode rule 1's first design was withdrawn for (D-022).
   *
   * The invariant these assert: a numeric span is either interpreted and checked, or reported as
   * uninterpretable. Suppression comes from a span an unreadable phrase actually produced, and anything
   * suppressed carries the finding with it (D-055).
   */

  const entry = (id: string, text: string): FactEntry => ({ id, text, kind: "employment", role: "R1", source: FROM_RESUME });
  const levels = (line: string, f: ReturnType<typeof factSet>) => checkLine(line, "R1.1", ["R1.1"], f).filter((x) => x.code === "value-unknown").map((x) => x.level);

  /** The same sentences with the space after the comma and without it. Nothing about a number changes between them. */
  const SLIPS: [string, string, string[]][] = [
    ["Built the OKR system in 2023, now used by 38 teams.", "Built the OKR system in 2023,now used by 38 teams.", ["year:2023", "num:38"]],
    ["Cut operating cost by USD 9.2M, then held it flat.", "Cut operating cost by USD 9.2M,then held it flat.", ["money:usd:9200000"]],
    ["Reduced cost 11 percent, against a 12 percent target.", "Reduced cost 11 percent,against a 12 percent target.", ["pct:11", "pct:12"]],
  ];

  it("reads the same values with the space and without, and reports nothing unreadable either way", () => {
    for (const [spaced, slipped, keys] of SLIPS) {
      for (const text of [spaced, slipped]) {
        const r = readNumbers(text);
        expect(`${text}: ${JSON.stringify(r.unreadable)}`).toBe(`${text}: []`);
        expect(`${text}: ${JSON.stringify(r.unreadableSpans)}`).toBe(`${text}: []`);
        expect(`${text}: ${JSON.stringify(claimsOf(text).map((c) => c.key))}`).toBe(`${text}: ${JSON.stringify(keys)}`);
      }
    }
  });

  it("reads them on the fact side too, so the profile carries what it says it carries", () => {
    for (const [, slipped, keys] of SLIPS) {
      const facts = factSet([entry("R1.1", slipped)]);
      expect(`${slipped}: ${JSON.stringify(facts.all.map((c) => c.key))}`).toBe(`${slipped}: ${JSON.stringify(keys)}`);
      // And nothing on this profile is unreadable, so D-040's guard is not what is carrying these cases.
      expect(facts.unreadablePhrases).toEqual([]);
    }
  });

  it("does not reject a truthful line for a missing space after a comma, which is the chain this closes", () => {
    // The whole chain in one test. The fact is written with the slip; the line states the same year cleanly and
    // cites that fact. Before the fix: the fact contributed no year:2023, the profile read as fully readable, and
    // the line took a hard value-unknown and lost its packet.
    const slipped = factSet([entry("R1.1", "Built the OKR system in 2023,now used by 38 teams.")]);
    expect(levels("Built the OKR system in 2023.", slipped)).toEqual([]);
    // The generated side of the same slip: a line that writes the comma without a space asserts its numbers and is
    // checked on them, rather than passing because they were quietly removed from the question.
    expect(levels("Built the OKR system in 2023,now used by 38 teams.", slipped)).toEqual([]);
    expect(levels("Built the OKR system in 1998,now used by 38 teams.", slipped)).toEqual(["hard"]);
  });

  it("suppresses the ambiguous occurrence and leaves a readable one that merely shares its leading digits", () => {
    /*
     * The tenth review's item 2, reproduced before the fix. The span was located by the phrase's leading digits,
     * `head,[\d,]*`, so in the input below the readable year in the second clause was suppressed for sharing a
     * head with the ambiguous run in the first. The invariant on the type was true of the head digits and false
     * of the occurrence, which is D-053's mistake in a different place.
     *
     * The consequence was milder than D-053's and is still real: `commas` is non-empty, so the profile reports an
     * unreadable phrase, D-040 demotes and the truthful line is held rather than rejected. On the generated side
     * the mechanism is different and worth stating rather than merging into one: the line's own claims are under
     * reported rather than unmatched, so `number-unreadable` is what holds it, not the demotion. Held either way,
     * never rejected, through two different paths.
     */
    for (const text of ["Ambiguous 2023,4; In 2023,we launched.", "In 2023,we launched. Ambiguous 2023,4 teams."]) {
      const r = readNumbers(text);
      expect(`${text}: ${JSON.stringify(r.unreadable)}`).toBe(`${text}: ["2023,4"]`);
      // One span, on the ambiguous run, and not on the readable occurrence beside it.
      expect(r.unreadableSpans.map(([a, b]) => r.text.slice(a, b))).toEqual(["2023,4"]);
      expect(claimsOf(text).map((c) => c.key)).toEqual(["year:2023"]);
    }
    // A repeated head where both occurrences really are ambiguous: both are runs, so both are suppressed.
    expect(claimsOf("Ran 2023,4 and 2023,5 programmes.").map((c) => c.key)).toEqual([]);
    expect(readNumbers("Ran 2023,4 and 2023,5 programmes.").unreadable).toEqual(["2023,4", "2023,5"]);
  });

  it("holds and does not reject on the fact side, and holds by a different finding on the line side", () => {
    // Both mechanisms asserted, because "held either way" through two paths is the kind of thing that gets
    // simplified into one and then gets one of them wrong.
    const facts = factSet([entry("R1.1", "Ambiguous 2023,4; In 2023,we launched.")]);
    // The fact side: the readable year is evidence again, so a truthful line stating it matches and says nothing.
    expect(facts.all.map((c) => c.key)).toEqual(["year:2023"]);
    expect(levels("Launched the pricing review in 2023.", facts)).toEqual([]);
    // And an unmatched value on this profile is held rather than rejected, because a phrase could not be read.
    expect(facts.unreadablePhrases).toEqual(["2023,4"]);
    expect(levels("Launched the pricing review in 1998.", facts)).toEqual(["review"]);
    // The line side: the line's own ambiguous run yields no claim, so nothing is unmatched and the demotion is
    // not what holds it. `number-unreadable` is.
    const clean = factSet([entry("R1.1", "Launched the pricing review in 2023.")]);
    expect(clean.unreadablePhrases).toEqual([]);
    const found = checkLine("Ambiguous 2023,4; In 2023,we launched.", "R1.1", ["R1.1"], clean);
    expect(found.filter((f) => f.code === "value-unknown")).toEqual([]);
    expect(found.filter((f) => f.code === "number-unreadable").map((f) => f.value)).toEqual(["2023,4"]);
  });

  it("does not suppress a bare head it cannot tell from another, and the cost of that is a fragment read", () => {
    /*
     * The guard on the wreckage fallback, and what it costs, asserted rather than described. D-053's case has one
     * bare `9,` in the output and is suppressed. Put a second bare `9,` in the same text and nothing can say which
     * is the wreckage, so neither is suppressed: the readable 9 is read, which is right, and the fragment "usd 9"
     * is read too, which is not.
     *
     * That is the pass direction, and D-040 does not cover it: the demotion softens an UNMATCHED value, and a
     * matched one produces no finding at all. Placed, not fixed, because the fix is offsets through the rewrite.
     */
    expect(claimsOf("Raised USD 9,2 hundred hundred").map((c) => c.key)).toEqual([]);
    expect(claimsOf("Raised USD 9,2 hundred hundred. Cut 9,then held it.").map((c) => c.key)).toEqual(["money:usd:9", "num:9"]);
    // The chain that follows from it, stated as a test so nobody has to take the paragraph's word for it.
    const unlocated = factSet([entry("R1.1", "Raised USD 9,2 hundred hundred. Cut 9,then held it.")]);
    expect(checkLine("Raised USD 9.", "R1.1", ["R1.1"], unlocated)).toEqual([]);
    const located = factSet([entry("R1.1", "Raised USD 9,2 hundred hundred.")]);
    expect(checkLine("Raised USD 9.", "R1.1", ["R1.1"], located).map((f) => [f.level, f.code])).toEqual([["review", "value-unknown"]]);
  });

  it("still suppresses and still reports the ambiguous comma D-053 was written for", () => {
    // The case the patch was right about, unchanged: the digits after the comma are consumed by the word
    // machinery, "usd 9" is left behind, and it is neither read as a value nor passed over in silence.
    const r = readNumbers("Raised USD 9,2 hundred hundred");
    expect(r.unreadable).toContain("9,2");
    expect(claimsOf("Raised USD 9,2 hundred hundred").map((c) => c.key)).toEqual([]);
    // Every span this function reports is produced by a phrase it reports. That is the invariant, asserted here
    // over each shape rather than left to the cases above to imply.
    for (const text of ["Raised USD 9,2 hundred hundred", "Raised USD 9,2 million", "Grew revenue five thousand two million", "Managed 4, 5 and 6 teams", ...SLIPS.flatMap(([a, b]) => [a, b])]) {
      const { unreadable, unreadableSpans } = readNumbers(text);
      expect(unreadableSpans.length && !unreadable.length ? `${text}: ${unreadableSpans.length} span(s) and no phrase to explain them` : text).toBe(text);
    }
  });
});

describe("a value is rejected only when the profile's own numbers could all be read", () => {
  /*
   * The sixth review's item 3. `value-unknown` is the one finding D-036 lets
   * reject, and the argument for that is "a figure either appears on the
   * profile or it does not". The lookup runs over parsed values, so a fact
   * whose own number the normaliser could not read contributes nothing to
   * compare against, and the certainty the level rests on is not there.
   * Both cases below were reproduced against this module before the fix.
   */

  const entry = (id: string, text: string): FactEntry => ({ id, text, kind: "employment", role: "R1", source: FROM_RESUME });
  const cleanSet = factSet([entry("R1.1", "Joined the company in 2010."), entry("R1.2", "Raised USD 9.2 million in Series B.")]);
  const wordSet = factSet([entry("R1.1", "Joined the company in twenty ten."), entry("R1.2", "Raised USD 9.2 million in Series B.")]);
  const commaSet = factSet([entry("R1.1", "Joined the company in 2010."), entry("R1.2", "Raised USD 9,2 million in Series B.")]);
  const levels = (line: string, f: ReturnType<typeof factSet>) => checkLine(line, "R1.1", ["R1.1", "R1.2"], f).filter((x) => x.code === "value-unknown").map((x) => x.level);

  it("reports a comma between digits that was not a thousands separator, because nothing can say which it is", () => {
    // "9,2" is a decimal comma or a typed separator and the text does not say. Guessing either way invents a value.
    expect(readNumbers("Raised USD 9,2 million").unreadable).toEqual(["9,2 million"]);
    expect(readNumbers("a study of 2,000 customers").unreadable).toEqual([]);
    expect(readNumbers("150,000 to 175,000").unreadable).toEqual([]);
    expect(readNumbers("1,234,567 rows").unreadable).toEqual([]);
    expect(readNumbers("4, 5 and 6 teams").unreadable).toEqual([]);
    // The phrase reads as it was written, scale word included.
    expect(readNumbers("9,2m and 3,4 thousand").unreadable).toEqual(["9,2m", "3,4 thousand"]);
  });

  it("rejects a value nowhere on a profile whose numbers all read", () => {
    expect(levels("Joined the company in 2010.", cleanSet)).toEqual([]);
    expect(levels("Joined the company in 1998.", cleanSet)).toEqual(["hard"]);
  });

  it("holds rather than rejects when a fact carries a word number the grammar could not read", () => {
    // The first reproduced case. "Joined in twenty ten" parses to no value at all, so the truthful line matches
    // nothing. Before this it was a hard finding and the packet lost its document over a fact the profile carries.
    expect(levels("Joined the company in 2010.", wordSet)).toEqual(["review"]);
    // And the finding says why, rather than claiming the value is on no fact.
    const f = checkLine("Joined the company in 2010.", "R1.1", ["R1.1"], wordSet).find((x) => x.code === "value-unknown")!;
    expect(f.message).toBe("value matches no readable fact, and a number phrase on the profile could not be read");
    expect(f.detail).toContain("twenty ten");
  });

  it("holds rather than rejects when a fact carries a decimal comma", () => {
    // The second reproduced case, and the one the review's own prescription did not reach: "USD 9,2 million" parsed
    // silently into USD 9 and a separate 2000000, so nothing marked it and the truthful line was rejected.
    expect(levels("Raised USD 9.2 million in Series B.", commaSet)).toEqual(["review"]);
    expect(levels("Raised USD 9.2 million in Series B.", cleanSet)).toEqual([]);
  });

  it("holds every unmatched value on such a profile, not only the one the unreadable fact would have supported", () => {
    // The lookup is profile wide, so the fact that would have supported a line need not be the one it cites, and
    // nothing here can say which unreadable fact was the missing match. Every unmatched value is held (D-040).
    expect(levels("Joined in 1998 and raised USD 400 million.", wordSet)).toEqual(["review", "review"]);
    expect(levels("Joined in 1998 and raised USD 400 million.", cleanSet)).toEqual(["hard", "hard"]);
  });

  it("does not buy a second paid call with a held value, because a retry cannot make a fact readable", () => {
    const held = checkLine("Joined the company in 2010.", "R1.1", ["R1.1"], wordSet).filter((f) => f.code === "value-unknown");
    expect(held.every((f) => !actionable(f))).toBe(true);
  });

  it("names the phrases on the profile once each, however many facts repeat them", () => {
    const twice = factSet([entry("R1.1", "Joined in twenty ten."), entry("R1.2", "Left in twenty ten.")]);
    expect(twice.unreadablePhrases).toEqual(["twenty ten"]);
    expect(cleanSet.unreadablePhrases).toEqual([]);
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
    // "M&A" is capitalised and on no fact: held, and the packet keeps its resume.
    expect(good.filter((f) => f.level === "hard")).toEqual([]);
    expect(good.filter((f) => f.level === "review").map((f) => [f.code, f.value])).toEqual([["name-unknown", "M&A"]]);
    const bad = validateChangeSet(
      { summary: null, summaryFacts: [], changes: [{ bullet: "R1.2", text: "Cut operating cost 15 percent in an 18 month program.", facts: ["R1.2"] }], skills: [] },
      base,
      set,
    );
    expect(bad.filter((f) => f.level === "hard").map((f) => f.value).sort()).toEqual(["num:18", "pct:15"]);
    // A summary with a value and no citation is rejected like any line.
    const unc = validateChangeSet({ summary: "Leader with 10 years of experience.", summaryFacts: [], changes: [], skills: [] }, base, set);
    // Citing nothing is held. "10 years" is on the profile, so the value passes wherever it was cited from.
    // "Leader" opens the sentence, is not a verb and is on no fact: held, never rejected (D-036).
    expect(unc.map((f) => [f.level, f.bullet, f.message])).toEqual([
      ["review", "summary", "no fact cited for this line"],
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
