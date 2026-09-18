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
    // Light verbs and plain adjectives with no telling ending are a closed class, like the function words.
    expect(["complex", "clear", "use", "needs", "key", "senior"].map(nounShaped)).toEqual([false, false, false, false, false, false]);
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
      ["services", ["object"]],
      [".NET", ["form"]],
    ]);
    expect(t("Reported to the CMO at Arvento")).toEqual([
      ["CMO", ["form"]],
      ["Arvento", ["proper"]],
    ]);
    // A posting word outside a claim position does not fire as a posting word; the sentence start still holds it.
    expect(t("Salesforce implementation specialist")).toEqual([["Salesforce", ["sentence start"]]]);
    // A verb at sentence start is a verb: capitalised because it is first, whatever the resume said.
    expect(t("Owned the roadmap")).toEqual([["roadmap", ["object", "posting"]]]);
    expect(t("Established repeatable practices")).toEqual([]);
    expect(t("Redesigned the division")).toEqual([["division", ["object"]]]);
    // The posting signal wants a noun: the posting's verbs and adjectives are rewording.
    // "translating" is a verb by its ending and "complex" a light adjective: neither fires. A posting noun fires wherever it stands.
    expect(entityTokens("Translating complex requirements", lemmasOf("translating complex requirements"), profile, "anywhere").map((x) => x.token)).toEqual(["requirements"]);
    // "translating" is not a responsibility verb, so nothing here stands in a claim position.
    expect(entityTokens("Translating complex requirements", lemmasOf("translating complex requirements"), profile).map((x) => x.token)).toEqual([]);
    // "set" opens an object run: "feedback loops" is a claim; "the roadmap" after "for" is not.
    expect(entityTokens("Set up feedback loops for the roadmap", lemmasOf("feedback loops roadmap"), profile).map((x) => [x.token, x.signals])).toEqual([
      ["loops", ["object", "posting"]],
      ["feedback", ["posting"]],
    ]);
    expect(entityTokens("Set up feedback loops for the roadmap", lemmasOf("feedback loops roadmap"), profile, "anywhere").map((x) => x.token)).toEqual(["loops", "feedback", "roadmap"]);
    // The posting's vocabulary in a rewording, outside any object: not a claim (D-023).
    const post = lemmasOf("attention to detail, senior leaders, usage trends, roadmap");
    const postingOnly = (line: string) => entityTokens(line, post, profile).filter((x) => x.signals.includes("posting")).map((x) => x.token);
    expect(postingOnly("Prepared the monthly pack with attention to detail")).toEqual([]);
    expect(postingOnly("Reporting to the CEO and partnering with senior leaders")).toEqual([]);
    expect(entityTokens("Owned the roadmap and partnered with senior leaders", post, profile).map((x) => [x.token, x.signals])).toEqual([["roadmap", ["object", "posting"]]]);
    // The summary's claims have no verb: "experience in", "experienced in" open a claim position, and so does the third person voice.
    const summaryPost = lemmasOf("governance, issue resolution, experience, leader, operations");
    const summaryPosting = (line: string) => entityTokens(line, summaryPost, profile).filter((x) => x.signals.includes("posting")).map((x) => x.token);
    // "and governance" is a second conjunct of the same claim position (review four, 5B).
    expect(summaryPosting("Strategy and PMO leader experienced in issue resolution and governance")).toEqual(["issue", "resolution", "governance"]);
    expect(summaryPosting("Strategy and PMO leader with experience in governance")).toEqual(["governance"]);
    expect(entityTokens("Strategy and PMO leader who develops governance", summaryPost, profile).filter((x) => x.signals.includes("posting")).map((x) => [x.token, x.signals])).toEqual([["governance", ["object", "posting"]]]);
    // "leader" and "experience" themselves are the posting's vocabulary in a rewording, not claims; what the experience is in, is.
    expect(summaryPosting("Strategy and PMO leader with experience improving operations")).toEqual(["operations"]);
    expect(summaryPosting("Strategy and PMO leader")).toEqual([]);
  });
});

describe("findings", () => {
  const fact = "Ran the pricing workstream of a telecom postpaid relaunch, with a conjoint study of 2,000 customers, that lifted ARPU 6 percent in the first year.";
  it("holds the reviewer's lines and names what fired", () => {
    expect(found("Implemented salesforce workflows", "Built dashboards in Excel", lemmasOf("Salesforce experience required"))).toEqual([
      ["workflows", "responsibility is not in the cited facts", "the cited fact says dashboards"],
      ["salesforce", "word from the posting appears in no confirmed fact", "the posting uses it"],
    ]);
    // The same word outside a claim position is a rewording, and passes as a posting word; the object rule still binds the head.
    expect(found("Built dashboards in Excel for salesforce users", "Built dashboards in Excel", lemmasOf("Salesforce experience required"))).toEqual([]);
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
    // ARPU is on another fact of the profile, so it exists; as the object of "reported" under a fact that never names it, the relationship is
    // unsupported (review four, finding 6). Outside a claim position it is the user's to place.
    expect(found("Reported ARPU to the CEO", "Built dashboards in Excel")).toEqual([["ARPU", "responsibility is not in the cited facts", "the cited fact says dashboards"]]);
    expect(found("Built dashboards in Excel, with ARPU as the headline", "Built dashboards in Excel")).toEqual([]);
    expect(found("Reported EBITDA to the CEO", "Built dashboards in Excel")).toEqual([["EBITDA", "name appears in no confirmed fact", "by its form"]]);
    // "workstream" is on the profile, in a fact this line does not cite: the responsibility is borrowed.
    expect(found("Led the pricing workstream", "Built dashboards in Excel")).toEqual([["workstream", "responsibility is not in the cited facts", "the cited fact says dashboards"]]);
  });
  it("review four, findings 5 and 6: a coordinated object, an instrument, a qualification, a global entity in a claim position, and capitalisation", () => {
    const excel = "Built dashboards in Excel.";
    const salesforcePosting = lemmasOf("Salesforce, recruitment systems");
    // 5A: the tool after "using" is a claim position; a posting noun there is held, and so is a tool the cited fact does not name.
    expect(found("Built dashboards using salesforce data", excel, salesforcePosting).map((f) => f[0])).toEqual(["salesforce"]);
    expect(found("Built dashboards using Tableau", excel)).toEqual([["Tableau", "name appears in no confirmed fact", "capitalised"]]);
    expect(found("Built dashboards using Power BI", excel)).toEqual([
      ["BI", "tool is not in the cited facts", "the cited fact says Excel"],
      ["Power", "entity is on the profile but not in the cited facts", "the cited fact says Excel"],
    ]);
    // 5B: every conjunct of a coordinated object is a claim.
    expect(found("Built dashboards and recruitment systems", excel, salesforcePosting).map((f) => [f[0], f[1]]).sort()).toEqual([
      ["recruitment", "word from the posting appears in no confirmed fact"],
      // "systems" is a posting word on no fact of this profile; the first question answers before the second is asked.
      ["systems", "word from the posting appears in no confirmed fact"],
    ]);
    expect(found("Built dashboards and reports", excel)).toEqual([]);
    // 5C: a qualification word is a claim wherever it stands.
    expect(found("Certified in Excel", excel)).toEqual([["Certified", "qualification appears in no confirmed fact", "a certification or licence is a claim wherever it stands"]]);
    expect(found("Used Excel", excel)).toEqual([]);
    // 6: an entity the profile has, in a claim position under a fact that does not name it, is held; capitalisation changes nothing.
    const knowsSalesforce = new Set([...profile, ...lemmasOf("Used Salesforce for the sales pipeline. Led recruitment of analysts.")]);
    const foundKnowing = (line: string) => entityFindings(line, "R1.1", cited(excel), knowsSalesforce, none).map((f) => [f.value, f.message, f.detail]);
    expect(foundKnowing("Built dashboards in Salesforce")).toEqual([["Salesforce", "tool is not in the cited facts", "the cited fact says Excel"]]);
    expect(foundKnowing("Built dashboards using salesforce data")).toEqual([["salesforce", "tool is not in the cited facts", "the cited fact says Excel"]]);
    expect(found("Built dashboards in Excel", excel)).toEqual([]);
    expect(foundKnowing("Led recruitment").map((f) => [f[0], f[1]])).toEqual([["recruitment", "responsibility is not in the cited facts"]]);
    expect(foundKnowing("Led RECRUITMENT").map((f) => [f[0], f[1]])).toEqual([["RECRUITMENT", "responsibility is not in the cited facts"]]);
    // "with" opens an instrument for an entity only: a rewording after it passes, a named tool the fact lacks does not.
    expect(found("Built dashboards with attention to detail", excel)).toEqual([]);
    expect(foundKnowing("Built dashboards with Salesforce")).toEqual([["Salesforce", "entity is on the profile but not in the cited facts", "the cited fact says Excel"]]);
  });
});
