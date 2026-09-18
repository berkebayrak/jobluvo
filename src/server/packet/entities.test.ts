import { describe, expect, it } from "vitest";
import { entityFindings, entityTokens, lemmasOf, nounShaped, tokensOf } from "./entities";

/*
 * Does a name exist on the profile at all. The relationship question, whether
 * the facts a line cites support what it asserts, is gone (D-034), and with it
 * every test below that asked it. What is left is the existence check and the
 * claim position scope that keeps the posting rule off ordinary rewording.
 *
 * Every finding here is review, never hard (D-036). All of them rest on
 * reading a word's shape, and a shape is a guess: a guess may hold a packet
 * for a person, it may not destroy the work. The value check in validate.ts is
 * the only one certain enough to reject.
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
const found = (line: string, posting = none) => entityFindings(line, "R1.1", profile, posting).map((f) => [f.value, f.message, f.detail]);

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
    // Light verbs and plain adjectives with no telling ending are a closed class, like the function words.
    expect(["complex", "clear", "use", "needs", "key", "senior"].map(nounShaped)).toEqual([false, false, false, false, false, false]);
  });
});

describe("signals", () => {
  it("fires on form, on a capital mid sentence, on a non verb at sentence start, and on a posting word", () => {
    const posting = lemmasOf("We use Salesforce daily. You will own the roadmap and the KPI framework.");
    const t = (line: string) => entityTokens(line, posting, profile).map((x) => [x.token, x.signals]);
    expect(t("Built C++ and .NET services")).toEqual([
      ["C++", ["form"]],
      [".NET", ["form"]],
    ]);
    // "Salesforce" is in the object of "Ran" and the posting uses it, so both signals fire on the one token.
    expect(t("Ran the Salesforce migration")).toEqual([["Salesforce", ["posting", "proper"]]]);
    // A capitalised verb at the start of a sentence is the resume's style, not a name.
    expect(t("Led the team")).toEqual([]);
    expect(t("Salesforce migration owner")).toEqual([["Salesforce", ["sentence start"]]]);
    // A qualification word is a claim wherever it stands.
    expect(t("Certified in Excel")).toEqual([
      ["Certified", ["qualification"]],
      ["Excel", ["proper"]],
    ]);
  });

  it("scopes a posting word to a claim position, so the posting's vocabulary in a rewording passes", () => {
    const posting = lemmasOf("Salesforce, recruitment systems, dashboards, roadmap, attention to detail");
    const keys = (line: string) => entityTokens(line, posting, profile).filter((x) => x.signals.includes("posting")).map((x) => x.token);
    // Inside the object of a responsibility verb, and inside the instrument after it: a claim.
    expect(keys("Set up the roadmap")).toEqual(["roadmap"]);
    expect(keys("Built dashboards using salesforce data")).toEqual(["salesforce"]);
    // Outside one, the posting's own words in a rewording.
    expect(keys("Built dashboards in Excel with attention to detail")).toEqual([]);
  });
});

describe("findings", () => {
  it("holds nothing for a rewording, whatever words it moves around", () => {
    expect(found("Ran the pricing work for a telecom relaunch with a conjoint study")).toEqual([]);
    expect(found("Owned the pricing workstream of a telecom postpaid relaunch")).toEqual([]);
    expect(found("Built dashboards in Excel")).toEqual([]);
    expect(found("Built dashboards and reports")).toEqual([]);
    expect(found("Used Excel")).toEqual([]);
  });

  it("holds a name that is in no confirmed fact, by form, by capital, or at the start of a sentence", () => {
    expect(found("Built C++ applications")).toEqual([["C++", "name appears in no confirmed fact", "by its form"]]);
    expect(found("Built dashboards using Tableau")).toEqual([["Tableau", "name appears in no confirmed fact", "capitalised"]]);
    expect(found("Reported EBITDA to the CEO")).toEqual([["EBITDA", "name appears in no confirmed fact", "by its form"]]);
    expect(found("Salesforce implementation specialist")).toEqual([["Salesforce", "name appears in no confirmed fact", "opens the sentence and is not a verb"]]);
    expect(entityFindings("Built C++ applications", "R1.1", profile, none)[0].level).toBe("review");
    // The tailored line survives a guess. That is the whole of D-036.
    expect(entityFindings("Built C++ applications", "R1.1", profile, none).some((f) => f.level === "hard")).toBe(false);
  });

  it("holds a word the model took from the posting, in a claim position, that no fact carries", () => {
    expect(found("Implemented salesforce workflows", lemmasOf("Salesforce experience required"))).toEqual([
      ["salesforce", "word from the posting appears in no confirmed fact", "the posting uses it"],
    ]);
    // The same word outside a claim position is the posting's vocabulary in a rewording.
    expect(found("Built dashboards in Excel for salesforce users", lemmasOf("Salesforce experience required"))).toEqual([]);
    expect(found("Built dashboards and recruitment systems", lemmasOf("Salesforce, recruitment systems")).map((f) => f[0]).sort()).toEqual(["recruitment", "systems"]);
  });

  it("holds a qualification no fact carries, and passes one a fact supports", () => {
    expect(found("Certified in Excel")).toEqual([["Certified", "qualification appears in no confirmed fact", "a certification or licence is a claim wherever it stands"]]);
    const certified = new Set([...profile, ...lemmasOf("Certified Scrum Master since 2019.")]);
    expect(entityFindings("Certified in Excel", "R1.1", certified, none)).toEqual([]);
  });

  it("passes a name the profile has anywhere, whatever line it is put on: that is the check the user chose", () => {
    // Salesforce is on the profile under another role. Under the removed relationship rule this was held; it now passes,
    // and the tailoring prompt is what says a tool may not move between roles (D-034).
    const knowsSalesforce = new Set([...profile, ...lemmasOf("Used Salesforce for the sales pipeline. Led recruitment of analysts.")]);
    const knowing = (line: string) => entityFindings(line, "R1.1", knowsSalesforce, none);
    expect(knowing("Built dashboards in Salesforce")).toEqual([]);
    expect(knowing("Built dashboards using salesforce data")).toEqual([]);
    expect(knowing("Led recruitment")).toEqual([]);
    expect(knowing("Led RECRUITMENT")).toEqual([]);
    expect(found("Reported ARPU to the CEO")).toEqual([]);
    expect(found("Led the pricing workstream")).toEqual([]);
  });
});
