import { describe, expect, it } from "vitest";
import type { ResumeFacts } from "@/server/match/profile";
import { claimsOf, contradiction, lemma, metricsAgree, segmentsOf } from "./claims";
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
        "Reduced customer churn by 11 percent.",
        "Reduced costs by 20 percent; increased revenue by 10 percent.",
        "Own the annual planning cycle, presented to the board twice a year.",
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
  it("reads each value from its own predicate, and a period as a claim", () => {
    expect(segmentsOf("designed and ran a program that cut cost 11 percent")).toEqual(["designed and ran a program that cut cost 11 percent"]);
    expect(segmentsOf("increased revenue by 20 percent and reduced cost by 10 percent")).toEqual(["increased revenue by 20 percent", "reduced cost by 10 percent"]);
    expect(segmentsOf("cut cost 11 percent and moved on")).toEqual(["cut cost 11 percent and moved on"]);
    const two = claimsOf("Increased revenue by 20 percent and reduced costs by 10 percent");
    expect(two.map((c) => [c.key, c.direction, c.metric])).toEqual([
      ["pct:20", "up", ["revenue"]],
      ["pct:10", "down", ["cost"]],
    ]);
    // An apposition with no words of its own measures what the predicate before it measured.
    expect(claimsOf("Reduced operating cost by 11 percent, or USD 9.2M a year").map((c) => [c.key, c.metric])).toEqual([
      ["pct:11", ["operating", "cost"]],
      ["money:usd:9200000", ["operating", "cost"]],
      ["period:year", ["operating", "cost"]],
    ]);
    expect(claimsOf("presented to the board twice a year").map((c) => c.key)).toEqual(["period:year"]);
    expect(claimsOf("reviewed quarterly").map((c) => c.key)).toEqual(["period:quarter"]);
    expect(claimsOf("a 3 year program").map((c) => c.key)).toEqual(["num:3"]);
  });
  it("the review's three reproductions: a changed metric, swapped results, and a period the fact never gave", () => {
    // One shared word is not the same metric.
    expect(hard("R1.5", "Reduced customer acquisition costs by 11 percent", ["R1.5"])).toEqual([]);
    expect(review("R1.5", "Reduced customer acquisition costs by 11 percent", ["R1.5"])).toEqual([
      expect.objectContaining({ message: "the fact and the line measure different things", value: "pct:11" }),
    ]);
    expect(at("R1.5", "Reduced customer churn 11 percent", ["R1.5"])).toEqual([]);
    expect(at("R1.5", "Cut churn by 11 percent", ["R1.5"])).toEqual([]);
    // Each value carries its own predicate's direction; the swap is a fall that became a rise.
    expect(hard("R1.6", "Increased revenue by 20 percent and reduced costs by 10 percent", ["R1.6"]).map((f) => [f.value, f.message])).toEqual([
      ["pct:20", "value does not mean what the fact means: down became up"],
      ["pct:10", "value does not mean what the fact means: up became down"],
    ]);
    expect(at("R1.6", "Reduced costs by 20 percent and increased revenue by 10 percent", ["R1.6"])).toEqual([]);
    // "over 12 months" is a duration; "annually" is a period the fact never gave.
    expect(hard("R1.1", "Reduced churn by 11 percent annually", ["R1.1"])).toEqual([expect.objectContaining({ message: "value is on the profile but not in the cited facts", value: "period:year" })]);
    // The predicate's verb is not its metric: "Led" for "Ran" is rewording, and rule 1's business, not a changed measure.
    const led = at("R1.1", "Led the retention work that reduced churn by 11 percent over 12 months", ["R1.1"]);
    expect(led.filter((f) => f.level === "hard")).toEqual([]);
    // "retention work" is a measure the fact never named: every value in that predicate is held on it.
    expect(led.filter((f) => f.level === "review").map((f) => [f.value, f.message])).toEqual([
      ["pct:11", "the fact and the line measure different things"],
      ["num:12", "the fact and the line measure different things"],
    ]);
    expect(review("R1.1", "Drove churn down 11 percent over 12 months", ["R1.1"])).toEqual([]);
    // A period takes no role: "targets" before "twice a year" says what is presented, not that the period is a target.
    expect(at("R1.7", "Present targets and priorities to the board twice a year", ["R1.7"])).toEqual([]);
    // The line's side is its own predicate; the fact's side is its whole sentence, so folding the fact's clauses into one predicate passes.
    expect(at("R1.3", "Grew revenue with the new pricing from USD 9M to USD 14M in 2023", ["R1.3"]).filter((f) => f.level !== "soft")).toEqual([
      expect.objectContaining({ level: "review", value: "money:usd:9000000" }),
      expect.objectContaining({ level: "review", value: "money:usd:14000000" }),
    ]);
    expect(at("R1.5", "Cut customer churn by 11 percent", ["R1.5"])).toEqual([]);
    // An inflection is the same word: "removing" for "removed", "workstreams" for "workstream", "led" for "lead".
    expect(["removing", "removed", "removes", "remove"].map(lemma)).toEqual(["remov", "remov", "remov", "remov"]);
    expect(["workstreams", "workstream", "led", "lead", "priorities", "priority", "planned", "planning"].map(lemma)).toEqual(["workstream", "workstream", "lead", "lead", "priority", "priority", "plan", "plan"]);
    expect(review("R2.1", "Delivering growth projects, 9 for banks", ["R2.1"])).toEqual([]);
    expect(claimsOf("Revenue grew 20 percent").map((c) => c.metric)).toEqual([["revenue"]]);
    expect(at("R1.1", "Reduced churn by 11 percent over 12 months", ["R1.1"])).toEqual([]);
    expect(at("R1.1", "Reduced churn by 11 percent", ["R1.1"])).toEqual([]);
    // A period the fact gave, in another wording, is the same period.
    expect(at("R1.7", "Own annual planning; present to the board yearly", ["R1.7"])).toEqual([]);
    expect(hard("R1.7", "Own annual planning; present to the board monthly", ["R1.7"])).toEqual([expect.objectContaining({ value: "period:month" })]);
  });
  it("a value in no cited fact is still hard the way it was", () => {
    expect(hard("R1.1", "Reduced churn by 99 percent", ["R1.1"])).toEqual([expect.objectContaining({ message: "value appears in no confirmed fact", value: "pct:99" })]);
    expect(hard("R1.1", "Reduced churn by 40 percent", ["R1.1"])).toEqual([expect.objectContaining({ message: "value is on the profile but not in the cited facts", value: "pct:40" })]);
    expect(hard("R1.1", "Reduced churn by 11 percent", [])).toEqual([expect.objectContaining({ message: "value with no fact cited for it" })]);
  });
});
