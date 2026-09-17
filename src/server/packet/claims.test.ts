import { describe, expect, it } from "vitest";
import type { ResumeFacts } from "@/server/match/profile";
import { claimsOf, contradiction, metricsAgree } from "./claims";
import { factEntries } from "./resume";
import { checkLine, factSet, initialNamesOf, SENTENCE_INITIAL_NAMES } from "./validate";

/*
 * The claim model against the rewrites the review reproduced through the
 * old validator, each of which passed because the number was in the cited
 * fact: a percentage that became a team count, months that became years, a
 * target that became a result, a metric moved to another employer, a tool
 * in no fact. Each is now hard or held for review, and the truthful
 * rephrasings beside them still pass.
 */

const RESUME = { rowId: "r", origin: "upload" as const, hasEvidence: true };
const TYPED = { rowId: "t", origin: "edit" as const, hasEvidence: true };

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
      ],
    },
    { company: "Deloitte", title: "Consultant", start: "2019-06", end: "2022-02", bullets: ["Delivered 9 growth projects for banks.", "Cut reporting time by 40 percent."] },
  ],
  education: [{ institution: "Koc University", degree: "MBA", end: "2020-06" }],
  skills: [{ name: "Excel", years: 10 }],
  answers: [],
  sources: { employment: [RESUME, TYPED], education: [RESUME], skills: [RESUME] },
  prefsHash: "p",
  factsHash: "f",
};

const set = factSet(factEntries(FACTS));
const at = (bullet: string, line: string, cited: string[]) => checkLine(line, bullet, cited, set);
const hard = (bullet: string, line: string, cited: string[]) => at(bullet, line, cited).filter((f) => f.level === "hard");
const review = (bullet: string, line: string, cited: string[]) => at(bullet, line, cited).filter((f) => f.level === "review");
const soft = (bullet: string, line: string, cited: string[]) => at(bullet, line, cited).filter((f) => f.level === "soft");

describe("reading claims", () => {
  it("reads kind, unit, metric, role and direction from a line", () => {
    const c = claimsOf("Reduced churn by 11 percent against a 12 percent target.");
    expect(c.map((x) => [x.kind, x.value, x.role, x.direction])).toEqual([
      ["pct", 11, "result", "down"],
      ["pct", 12, "target", "down"],
    ]);
    expect(c[0].metric).toEqual(["churn"]);
    expect(claimsOf("Worked on the rollout for 12 months")[0]).toMatchObject({ kind: "duration", value: 12, unit: "month" });
    expect(claimsOf("Managed 11 teams")[0]).toMatchObject({ kind: "count", value: 11, unit: "team" });
    expect(claimsOf("Grew revenue from USD 9M to USD 14M in 2023").map((x) => [x.kind, x.value, x.role])).toEqual([
      ["money", 9000000, "baseline"],
      ["money", 14000000, "result"],
      ["year", "2023", "result"],
    ]);
    expect(claimsOf("Started in March 2022")[0]).toMatchObject({ kind: "date", value: "2022-03" });
  });
  it("names the contradiction between two claims with the same number, and none for a plain restatement", () => {
    const [churn] = claimsOf("Reduced churn by 11 percent");
    expect(contradiction(churn, claimsOf("Managed 11 teams")[0])).toBe("11 percent became 11 teams");
    const [months] = claimsOf("for 12 months");
    expect(contradiction(months, claimsOf("for 12 years")[0])).toBe("12 months became 12 years");
    const target = claimsOf("Reduced cost by 11 percent against a 12 percent target")[1];
    expect(contradiction(target, claimsOf("Reduced cost by 12 percent")[0])).toBe("a target became a result");
    expect(contradiction(churn, claimsOf("Increased churn by 11 percent")[0])).toBe("down became up");
    expect(contradiction(churn, claimsOf("Brought churn down 11 percent")[0])).toBeNull();
    expect(metricsAgree(churn, claimsOf("Cut customer attrition by 11 percent")[0])).toBe("differ");
    expect(metricsAgree(churn, claimsOf("11 percent")[0])).toBe("unreadable");
  });
});

describe("the validator on the review's rewrites", () => {
  it("a percentage that became a count of teams is hard", () => {
    expect(hard("R1.1", "Managed 11 teams", ["R1.1"])).toEqual([expect.objectContaining({ message: "value does not mean what the fact means: 11 percent became 11 teams", value: "num:11" })]);
  });
  it("months that became years is hard", () => {
    expect(hard("R1.1", "Worked on churn for 12 years", ["R1.1"])).toEqual([expect.objectContaining({ message: expect.stringContaining("12 months became 12 years") })]);
    expect(hard("R1.1", "Cut churn 11 percent in 12 months", ["R1.1"])).toEqual([]);
  });
  it("a target that became a result is hard", () => {
    expect(hard("R1.2", "Reduced cost by 12 percent", ["R1.2"])).toEqual([expect.objectContaining({ message: expect.stringContaining("a target became a result"), value: "pct:12" })]);
    expect(hard("R1.2", "Beat a 12 percent cost target, delivering an 11 percent reduction", ["R1.2"])).toEqual([]);
  });
  it("a fall that became a rise is hard; a baseline that became a result is hard", () => {
    expect(hard("R1.1", "Grew churn by 11 percent", ["R1.1"])).toEqual([expect.objectContaining({ message: expect.stringContaining("down became up") })]);
    expect(hard("R1.3", "Grew revenue to USD 9M", ["R1.3"])).toEqual([expect.objectContaining({ message: expect.stringContaining("a baseline became a result") })]);
    expect(hard("R1.3", "Grew revenue from USD 9M to USD 14M", ["R1.3"])).toEqual([]);
  });
  it("a metric moved to another employer is hard, whatever the value", () => {
    // The Deloitte line cites Arvento's churn fact: the number is real, the employer is wrong.
    expect(hard("R2.1", "Reduced churn by 11 percent for banking clients", ["R2.1", "R1.1"])).toEqual([
      expect.objectContaining({ message: "cites a fact from another role", value: "R1.1", detail: "R1.1 belongs to R1; this line is under R2" }),
    ]);
    // Citing the other role's heading is the same lie.
    expect(hard("R2.1", "Delivered 9 growth projects", ["R2.1", "R1"])).toEqual([expect.objectContaining({ value: "R1" })]);
    // A skill or a degree may be cited under any role, and the summary draws on every role.
    expect(hard("R2.1", "Delivered 9 growth projects, modelled in Excel", ["R2.1", "S1"])).toEqual([]);
    expect(hard("summary", "Leader who cut churn 11 percent and delivered 9 growth projects", ["R1.1", "R2.1"])).toEqual([]);
  });
  it("a value whose metric words differ is held for review, not rejected; one whose metric cannot be read too", () => {
    expect(hard("R1.1", "Cut customer attrition by 11 percent", ["R1.1"])).toEqual([]);
    expect(review("R1.1", "Cut customer attrition by 11 percent", ["R1.1"])).toEqual([
      expect.objectContaining({ message: "the fact and the line measure different things", value: "pct:11", detail: expect.stringContaining("fact: reduced churn by 11 percent") }),
    ]);
    expect(review("R1.1", "11 percent", ["R1.1"])).toEqual([expect.objectContaining({ message: expect.stringContaining("could not be read") })]);
    expect(review("R1.1", "Reduced churn 11 percent", ["R1.1"])).toEqual([]);
  });
  it("a tool, employer or qualification in no fact is held for review, including at the start of a sentence", () => {
    expect(review("R1.4", "Managed dashboards in Salesforce for 6 analysts", ["R1.4"])).toEqual([expect.objectContaining({ message: "name appears in no confirmed fact", value: "Salesforce" })]);
    expect(initialNamesOf("Salesforce implementation specialist for the team.")).toEqual(["Salesforce"]);
    expect(initialNamesOf("Led the team. Power BI reporting owner.")).toEqual(["Led", "Power BI"]);
    const f = at("R1.4", "Salesforce implementation specialist for 6 analysts", ["R1.4"]);
    expect(f).toEqual([expect.objectContaining({ level: SENTENCE_INITIAL_NAMES, value: "Salesforce", detail: "sentence initial" })]);
    // A verb the resume uses is on the profile; the review counts the ones it does not.
    expect(at("R1.4", "Managed 6 analysts", ["R1.4"])).toEqual([]);
  });
  it("a value supported only by a line the user typed passes, and says so", () => {
    expect(hard("R2.2", "Reduced reporting time 40 percent", ["R2.2"])).toEqual([]);
    expect(soft("R2.2", "Reduced reporting time 40 percent", ["R2.2"])).toEqual([
      expect.objectContaining({ message: "value is from a line you typed, not the resume's words", value: "pct:40", origin: "edit" }),
    ]);
    expect(soft("R1.1", "Reduced churn 11 percent", ["R1.1"])).toEqual([]);
  });
  it("a value in no cited fact is still hard the way it was", () => {
    expect(hard("R1.1", "Reduced churn by 99 percent", ["R1.1"])).toEqual([expect.objectContaining({ message: "value appears in no confirmed fact", value: "pct:99" })]);
    expect(hard("R1.1", "Reduced churn by 40 percent", ["R1.1"])).toEqual([expect.objectContaining({ message: "value is on the profile but not in the cited facts", value: "pct:40" })]);
    expect(hard("R1.1", "Reduced churn by 11 percent", [])).toEqual([expect.objectContaining({ message: "value with no fact cited for it" })]);
  });
});
