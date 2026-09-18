import { describe, expect, it } from "vitest";
import type { ResumeFacts } from "@/server/match/profile";
import { claimsOf, lemma, sameValue } from "./claims";
import { factEntries } from "./resume";
import { checkLine, factSet } from "./validate";

/*
 * Value extraction, and the one question asked of it: does this value appear
 * anywhere in the user's confirmed facts.
 *
 * Most of what this file used to assert is gone with the code that answered
 * it (D-034): that a percentage became a count, that months became years,
 * that a target became a result, that a fall became a rise, that a metric
 * moved to another employer. Each of those was a comparison of what a line
 * means against what a fact means, and the tailoring prompt carries them now.
 * What is asserted here is that every value is still found and read into the
 * same canonical key, because the remaining check is only as good as that.
 */

const RESUME = { rowId: "r", origin: "upload" as const, hasEvidence: true };

const FACTS: ResumeFacts = {
  userId: "u",
  prefs: { targetCountries: ["US"], relocation: "yes", remote: "remote_ok" },
  employment: [
    {
      company: "Arvento",
      title: "Head of Strategy",
      start: "2022-03",
      bullets: [
        "Reduced churn by 11 percent over 12 months.",
        "Reduced cost by 11 percent against a 12 percent target.",
        "Grew revenue from USD 9M to USD 14M in 2023.",
        "Managed a team of 6 analysts.",
        "Own the annual planning cycle, presented to the board twice a year.",
      ],
    },
    { company: "Deloitte", title: "Consultant", start: "2019-06", end: "2022-02", bullets: ["Delivered 9 growth projects for banks.", "Cut reporting time by 40 percent."] },
  ],
  education: [{ institution: "Koc University", degree: "MBA", end: "2020-06" }],
  skills: [{ name: "Excel", years: 10 }],
  answers: [],
  sources: { employment: [RESUME, RESUME], education: [RESUME], skills: [RESUME] },
  prefsHash: "p",
  factsHash: "f",
};

const set = factSet(factEntries(FACTS));
const keys = (text: string) => claimsOf(text).map((c) => c.key);
const hard = (bullet: string, line: string, cited: string[]) => checkLine(line, bullet, cited, set).filter((f) => f.level === "hard").map((f) => f.value);

describe("reading values", () => {
  it("reads a percentage, money, a duration, a count, a date and a year into one key each", () => {
    expect(keys("Reduced churn by 11 percent over 12 months.")).toEqual(["pct:11", "num:12"]);
    expect(keys("Grew revenue from USD 9M to USD 14M in 2023.")).toEqual(["money:usd:9000000", "money:usd:14000000", "year:2023"]);
    expect(keys("Joined in March 2022.")).toEqual(["date:2022-03"]);
    expect(keys("Managed a team of 6 analysts.")).toEqual(["num:6"]);
  });

  it("reads a period with its frequency, so how often is a value like any other", () => {
    expect(keys("Presented to the board twice a year.")).toEqual(["period:2xyear"]);
    // "annually" is a period word, "annual" as an adjective is not: the pattern reads how often, not every mention of a year.
    expect(keys("Own the annual planning cycle.")).toEqual([]);
    expect(keys("Reviewed budgets annually.")).toEqual(["period:year"]);
    expect(keys("Presented reports quarterly.")).toEqual(["period:quarter"]);
  });

  it("keeps a sign the normaliser kept, so a fall is not read as a rise", () => {
    expect(keys("Achieved -11 percent revenue growth.")).toEqual(["pct:-11"]);
    expect(keys("Achieved 11 percent revenue growth.")).toEqual(["pct:11"]);
  });

  it("tells a four digit count from a year by what follows it", () => {
    expect(keys("a conjoint study of 2000 customers")).toEqual(["num:2000"]);
    expect(keys("in 2000 the team grew")).toEqual(["year:2000"]);
    expect(keys("Managed a team in 2000.")).toEqual(["year:2000"]);
  });

  it("reads values across a whole text rather than per predicate, because nothing asks which predicate a value belongs to now", () => {
    expect(keys("Cut costs by 11 percent; reviewed budgets annually and grew revenue 20 percent.")).toEqual(["pct:11", "period:year", "pct:20"]);
  });

  it("sameValue matches a number, a date, and a month date read as its year", () => {
    const [date] = claimsOf("Joined in March 2022.");
    const [year] = claimsOf("Joined in 2022.");
    expect(sameValue(date, year)).toBe(true);
    expect(sameValue(year, date)).toBe(false);
    // The key, not the bare number: a percentage is not a count, and euros are not dollars.
    expect(sameValue(claimsOf("11 percent")[0], claimsOf("11 units")[0])).toBe(false);
    expect(sameValue(claimsOf("USD 9.2M")[0], claimsOf("EUR 9.2M")[0])).toBe(false);
    expect(sameValue(claimsOf("11 percent")[0], claimsOf("11%")[0])).toBe(true);
  });

  it("lemma folds a word's forms together, crudely and on purpose", () => {
    // Crude on purpose: "removing" lands on "remov", and so does "removed", which is all this needs to do.
    expect(["removing", "removed", "removes", "led", "dashboards"].map(lemma)).toEqual(["remov", "remov", "remov", "lead", "dashboard"]);
  });
});

describe("the one check the validator makes on a value", () => {
  it("rejects a value in no confirmed fact, whatever line it is on", () => {
    expect(hard("R1.1", "Reduced churn by 14 percent.", ["R1.1"])).toEqual(["pct:14"]);
    expect(hard("R1.1", "Managed a team of 19 analysts.", ["R1.1"])).toEqual(["num:19"]);
  });

  it("passes a value that is anywhere on the profile, cited or not: the lookup is profile wide (D-034)", () => {
    // 40 percent is Deloitte's, on a line under Arvento, citing an Arvento fact. Held by the old rules, passes now.
    expect(hard("R1.1", "Reduced churn by 40 percent.", ["R1.1"])).toEqual([]);
    // Nothing cited at all, and the value is still on the profile.
    expect(hard("R1.1", "Reduced churn by 11 percent.", [])).toEqual([]);
  });

  it("passes a value moved to a different subject, which is what the prompt is now responsible for", () => {
    // 12 was the target in the fact and 11 the result; swapping them is case 2 and nothing in the code sees it.
    expect(hard("R1.2", "Reduced cost by 12 percent against an 11 percent target.", ["R1.2"])).toEqual([]);
  });
});
