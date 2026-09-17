import { describe, expect, it } from "vitest";
import { entityFindings, entityTokens, lemmasOf, nounShaped, objectsOf, tokensOf } from "./entities";

/*
 * The non numeric check on the reviewer's lines and the lines the first
 * design got wrong: a new entity, qualification or responsibility is held,
 * a rewording is not, and every finding says what to replace it with.
 */

const profile = lemmasOf(
  [
    "Lead the strategy and PMO function for a telematics company with USD 140M revenue, reporting to the CEO, with a team of four strategy managers and two analysts.",
    "Ran the pricing workstream of a telecom postpaid relaunch, with a conjoint study of 2,000 customers, that lifted ARPU 6 percent in the first year.",
    "Prepared the monthly performance pack for the executive committee, covering 900 branches and 4 product lines.",
    "Built dashboards in Excel and Power BI.",
    "Own the annual planning cycle: targets, initiative portfolio and budget with product and finance, presented to the board twice a year.",
  ].join("\n"),
);
const none = new Set<string>();
const cited = (text: string) => [{ id: "R1.1", text }];
const found = (line: string, factText: string, posting = none) => entityFindings(line, "R1.1", cited(factText), profile, posting).map((f) => [f.value, f.message, f.detail]);

describe("tokens and shapes", () => {
  it("keeps C++, C# and .NET whole, opens hyphens, and knows where a sentence starts", () => {
    expect(tokensOf("Built C++ and .NET services. Sales-adjacent work.").map((t) => t.raw)).toEqual(["Built", "C++", "and", ".NET", "services", "Sales-adjacent", "work"]);
    expect([...lemmasOf("trade-offs and cross-team work")]).toEqual(["trade-off", "cross-team", "work"]);
    expect(tokensOf("Led the team. Power BI owner.").map((t) => [t.raw, t.sentenceStart])).toEqual([
      ["Led", true],
      ["the", false],
      ["team", false],
      ["Power", true],
      ["BI", false],
      ["owner", false],
    ]);
    expect(tokensOf("planning: targets, portfolio").map((t) => t.endsClause)).toEqual([true, true, false]);
  });
  it("reads noun shape from the ending, crudely and on purpose", () => {
    expect(["roadmap", "headcount", "recruitment"].map(nounShaped)).toEqual([true, true, true]);
    expect(["translating", "improved", "clearly", "scalable", "led", "progress"].map(nounShaped)).toEqual([false, false, false, false, false, false]);
    // A known miss: an adjective with no telling ending reads as a noun. The posting signal pays for it in holds, not in passes.
    expect(nounShaped("complex")).toBe(true);
  });
  it("finds the object of a responsibility verb and its head", () => {
    expect(objectsOf("Led recruitment of analysts")).toEqual([{ verb: "lead", head: "recruitment" }]);
    expect(objectsOf("Ran the pricing workstream of a telecom relaunch, with a study")).toEqual([{ verb: "run", head: "workstream" }]);
    expect(objectsOf("Prepared the monthly performance pack for the committee")).toEqual([{ verb: "prepar", head: "pack" }]);
    // A value, a function word or punctuation ends the object; a verb with no object gives none.
    expect(objectsOf("Managed 6 analysts. Reported to the CEO.")).toEqual([]);
  });
});

describe("signals", () => {
  it("fires on form, on a capital mid sentence, on a non verb at sentence start, and on a posting word", () => {
    const posting = lemmasOf("We use Salesforce daily. You will own the roadmap and the KPI framework.");
    const t = (line: string) => entityTokens(line, posting, profile).map((x) => [x.token, x.signals]);
    // The object run ends at "and", so C++ is both the object and a form; .NET is a form; "services" is nothing on its own.
    expect(t("Built C++ and .NET services")).toEqual([
      ["C++", ["object", "form"]],
      [".NET", ["form"]],
    ]);
    expect(t("Reported to the CMO at Arvento")).toEqual([
      ["CMO", ["form"]],
      ["Arvento", ["proper"]],
    ]);
    expect(t("Salesforce implementation specialist")).toEqual([["Salesforce", ["posting", "sentence start"]]]);
    // A verb at sentence start is a verb: capitalised because it is first, whatever the resume said.
    expect(t("Owned the roadmap")).toEqual([["roadmap", ["object", "posting"]]]);
    expect(t("Established repeatable practices")).toEqual([]);
    expect(t("Redesigned the division")).toEqual([["division", ["object"]]]);
    // The posting signal wants a noun: the posting's verbs and adjectives are rewording.
    // "complex" is the known miss above; "translating" is a verb by its ending and does not fire.
    expect(entityTokens("Translating complex requirements", lemmasOf("translating complex requirements"), profile).map((x) => x.token)).toEqual(["complex", "requirements"]);
  });
});

describe("findings", () => {
  const fact = "Ran the pricing workstream of a telecom postpaid relaunch, with a conjoint study of 2,000 customers, that lifted ARPU 6 percent in the first year.";
  it("holds the reviewer's lines and names what fired", () => {
    expect(found("Implemented salesforce workflows", "Built dashboards in Excel", lemmasOf("Salesforce experience required"))).toEqual([
      ["workflows", "responsibility is not in the cited facts", "the cited fact says dashboards"],
      ["salesforce", "word from the posting appears in no confirmed fact", "the posting uses it"],
    ]);
    expect(found("Built C++ applications", "Built dashboards in Excel")).toEqual([
      ["applications", "responsibility is not in the cited facts", "the cited fact says dashboards"],
      ["C++", "name appears in no confirmed fact", "by its form"],
    ]);
    expect(found("Led recruitment of analysts", "Built dashboards in Excel")).toEqual([["recruitment", "responsibility is not in the cited facts", "the cited fact says dashboards"]]);
    expect(found("Built Excel automation", "Built dashboards in Excel")).toEqual([["automation", "responsibility is not in the cited facts", "the cited fact says dashboards"]]);
    expect(found("Salesforce implementation specialist", "Built dashboards in Excel")).toEqual([["Salesforce", "name appears in no confirmed fact", "opens the sentence and is not a verb"]]);
  });
  it("passes a rewording, and a responsibility the cited fact names", () => {
    expect(found("Ran the pricing work for a telecom relaunch with a conjoint study", fact)).toEqual([]);
    expect(found("Owned the pricing workstream of a telecom postpaid relaunch", fact)).toEqual([]);
    expect(found("Prepared the monthly performance pack for the executive committee", "Prepared the monthly performance pack for the executive committee, covering 900 branches.")).toEqual([]);
  });
  it("binds a responsibility to the cited fact, the way the employer rule binds a value, and says what the fact calls it", () => {
    // "analysis" is on the profile and not in this fact: held, with the word the same verb has in the fact.
    expect(found("Ran pricing analysis for a telecom postpaid relaunch", fact)).toEqual([["analysis", "responsibility is not in the cited facts", "the cited fact says workstream"]]);
    expect(found("Prepared the monthly performance dashboard for the executive committee", "Prepared the monthly performance pack for the executive committee.")).toEqual([
      ["dashboard", "responsibility is not in the cited facts", "the cited fact says pack"],
    ]);
    // A different verb: the hint is the first object the cited fact has.
    expect(found("Led pricing analysis for a telecom postpaid relaunch", fact)).toEqual([["analysis", "responsibility is not in the cited facts", "the cited fact says workstream"]]);
    // A generic object asserts nothing a fact could contradict.
    expect(found("Own annual planning; present progress and recommendations to the board twice a year", "Own the annual planning cycle, presented to the board twice a year.")).toEqual([]);
  });
  it("checks entities against the whole profile and objects against the cited facts", () => {
    // ARPU is on another fact of the profile: an entity the user owns anywhere is theirs to place, even as the object of "reported".
    expect(found("Reported ARPU to the CEO", "Built dashboards in Excel")).toEqual([]);
    expect(found("Reported EBITDA to the CEO", "Built dashboards in Excel")).toEqual([["EBITDA", "name appears in no confirmed fact", "by its form"]]);
    // "workstream" is on the profile, in a fact this line does not cite: the responsibility is borrowed.
    expect(found("Led the pricing workstream", "Built dashboards in Excel")).toEqual([["workstream", "responsibility is not in the cited facts", "the cited fact says dashboards"]]);
  });
});
