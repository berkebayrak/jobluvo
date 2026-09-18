import { describe, expect, it } from "vitest";
import type { ResumeFacts } from "@/server/match/profile";
import { lemmasOf } from "./entities";
import { factEntries } from "./resume";
import { checkLine, factSet } from "./validate";

/*
 * The evaluation set, and what it is now for.
 *
 * Every pair is a truthful rewording that must pass and a false rewrite that
 * should not be shipped. This file used to assert that the validator caught
 * every false line, and it did: 28 of 28. It no longer asserts that, because
 * the code no longer does it. The meaning comparison was removed by the user's
 * decision (D-034), and measured against these same lines the code that
 * remains catches 8 of 28.
 *
 * READ THIS BEFORE CITING THIS FILE. It is not evidence that Jobluvo catches
 * fabrication. It is a record of a set of false lines, split into the few the
 * code still rejects and the many the tailoring prompt alone is responsible
 * for. Nothing below asserts that a recorded line is caught, and nothing below
 * should be read as saying the system is safe against the cases in it.
 *
 * Three things are asserted, and they are worth asserting:
 *
 *  - Every truthful line passes. 26 of 26. Removing rules cannot create a
 *    false positive, and this is what says so as the remaining check changes.
 *  - The lines the invention check does reject are still rejected, named one
 *    by one, so that check cannot quietly stop working.
 *  - The counts are printed by author and by case, never summed, which is the
 *    rule that survived review five and the reason the misleading 28 was found.
 *
 * The second author's fourteen are in the file too (FOURTEEN below), on the
 * profile they were written against. None of them was ever caught, and none of
 * them is caught now. They are here so that nobody has to go and find them
 * again.
 *
 * Add a pair whenever a miss is found in the wild, with its author; never
 * remove one.
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
        "Reduced churn 11 percent, and cut acquisition cost 5 percent.",
        "Trained 6 analysts.",
        "Did not manage 6 analysts.",
        "Reduced churn by 11 percent.",
        "Achieved -11 percent revenue growth.",
        "Presented reports twice a year.",
        "Cut costs by 11 percent; reviewed budgets annually.",
        "Built dashboards in Excel.",
        "Grew the team from 4 to 9 people.",
        "Ran the pricing review across 3 markets.",
      ],
    },
    {
      company: "Deloitte",
      title: "Consultant",
      start: "2019-06",
      end: "2022-02",
      bullets: ["Used Salesforce for the sales pipeline.", "Led recruitment of analysts.", "Delivered 9 growth projects for banks, using a conjoint study of 2,000 customers that lifted ARPU 6 percent."],
    },
  ],
  education: [{ institution: "Koc University", degree: "MBA", end: "2020-06" }],
  skills: [{ name: "Excel", years: 10 }],
  answers: [],
  sources: { employment: [RESUME, RESUME], education: [RESUME], skills: [RESUME] },
  prefsHash: "p",
  factsHash: "f",
};

const set = factSet(factEntries(FACTS));
const posting = lemmasOf("Salesforce, recruitment systems, dashboards, analytics");

/**
 * Who wrote the case. "rules" is someone who had written or read the rules
 * before writing the example, which is most of these. "independent" is
 * someone reviewing the implementation from outside, whose misses are the
 * only evidence here about what nobody thought of.
 */
type Author = "rules" | "independent";

/**
 * What the false lines of this pair do, against the validator's principle:
 * a tailored line may change how something is said, it may not change what
 * is being claimed (the top of design/docs/06-Decision-Log.md).
 *
 * The truthful lines of every pair are case 1 by definition, so the case
 * here names what the FALSE lines do.
 *
 * - "case 2": the same number attached to a different thing.
 * - "case 3": the same work at a higher level of authority.
 * - "invention": a value, entity, tool or qualification in no cited fact at
 *   all. Never in dispute, which is why it is not one of the principle's
 *   three cases, but most of this file is it and saying so is the point:
 *   counting it beside case 3 is how "28 of 28" hid that nobody had written
 *   a case 3 test.
 * - "polarity": the claim is negated rather than moved or promoted. It fits
 *   the principle's sentence and none of its three cases; whether it becomes
 *   a named case 4 is the user's call, recorded in the log.
 */
type Case = "case 2" | "case 3" | "invention" | "polarity";

/** A false line, at the pair's case unless it says otherwise: one pair can hold lines that fail in different ways. */
type FalseLine = string | { line: string; case: Case };

interface Pair {
  finding: string;
  author: Author;
  /** The case the pair's false lines belong to, unless a line names its own. */
  case: Case;
  bullet: string;
  cited: string[];
  /** Lines that must pass with no hard or review finding. */
  truthful: string[];
  /** Lines that must be held or rejected. */
  false: FalseLine[];
}

const PAIRS: Pair[] = [
  {
    finding: "3A, a value paired with a sibling value's measure",
    author: "rules",
    case: "case 2",
    bullet: "R1.1",
    cited: ["R1.1"],
    truthful: ["Cut churn 11 percent and reduced acquisition cost 5 percent.", "Reduced churn by 11 percent while cutting acquisition cost by 5 percent."],
    false: ["Reduced acquisition cost 11 percent.", "Cut churn 5 percent."],
  },
  {
    finding: "3B, the opening verb is a relationship",
    author: "rules",
    case: "case 3",
    bullet: "R1.2",
    cited: ["R1.2"],
    truthful: ["Coached 6 analysts.", "Trained six analysts."],
    // Training becoming managing is the promotion. Hiring is a different activity, not a higher rung of the same one.
    false: ["Managed 6 analysts.", { line: "Hired 6 analysts.", case: "invention" }],
  },
  {
    finding: "3C, a denial",
    author: "rules",
    case: "polarity",
    bullet: "R1.3",
    cited: ["R1.3"],
    truthful: ["Did not manage the 6 analysts."],
    false: ["Managed 6 analysts."],
  },
  {
    finding: "3D, a change against a level",
    author: "rules",
    case: "case 2",
    bullet: "R1.4",
    cited: ["R1.4"],
    truthful: ["Cut churn by 11 percent.", "Reduced churn by about 11 percent."],
    false: ["Reduced churn to 11 percent.", "Held churn at 11 percent."],
  },
  {
    finding: "3E, the sign",
    author: "rules",
    case: "polarity",
    bullet: "R1.5",
    cited: ["R1.5"],
    truthful: ["Revenue growth of -11 percent.", "Achieved revenue growth of -11 percent."],
    false: ["Achieved 11 percent revenue growth."],
  },
  {
    finding: "4A, the frequency of a period",
    author: "rules",
    case: "case 2",
    bullet: "R1.6",
    cited: ["R1.6"],
    truthful: ["Presented reports twice yearly.", "Presented reports 2 times a year."],
    false: ["Presented reports once a year.", "Presented reports annually.", "Presented reports quarterly."],
  },
  {
    finding: "4B, a period bound to its predicate",
    author: "rules",
    case: "case 2",
    bullet: "R1.7",
    cited: ["R1.7"],
    truthful: ["Cut costs by 11 percent and reviewed budgets annually.", "Reviewed budgets annually; cut costs by 11 percent."],
    false: ["Cut costs by 11 percent annually."],
  },
  {
    finding: "7, numbers the normaliser reads",
    author: "rules",
    case: "invention",
    bullet: "R1.9",
    cited: ["R1.9"],
    truthful: ["Grew the team from four to nine people.", "Grew the team from 4 to 9 people."],
    false: ["Grew the team from 4 to 19 people.", "Grew the team to 4 people."],
  },
  {
    finding: "a four digit count is not a year",
    author: "rules",
    case: "invention",
    bullet: "R2.3",
    cited: ["R2.3"],
    truthful: ["Delivered 9 growth projects for banks, with a study of 2,000 customers.", "Ran a conjoint study of 2000 customers that lifted ARPU 6 percent."],
    false: ["Ran a conjoint study of 2,000 users that lifted ARPU 6 percent.", "Ran a conjoint study of 2,000 customers that lifted ARPU 16 percent."],
  },
  {
    finding: "5A, the tool after using or in is a claim",
    author: "rules",
    case: "invention",
    bullet: "R1.8",
    cited: ["R1.8"],
    truthful: ["Built Excel dashboards.", "Built dashboards in Excel for the sales team.", "Built dashboards with attention to detail."],
    false: ["Built dashboards using salesforce data.", "Built dashboards using Tableau.", "Built dashboards in Salesforce."],
  },
  {
    finding: "5B, every conjunct of a coordinated object",
    author: "rules",
    case: "invention",
    bullet: "R1.8",
    cited: ["R1.8"],
    truthful: ["Built dashboards and reports in Excel."],
    false: ["Built dashboards and recruitment systems.", "Built dashboards and pricing models in Excel."],
  },
  {
    finding: "5C, a qualification",
    author: "rules",
    case: "invention",
    bullet: "R2.1",
    cited: ["R2.1"],
    truthful: ["Worked in Salesforce for the sales pipeline.", "Used Salesforce to run the sales pipeline."],
    false: ["Certified in Salesforce.", "Salesforce certified, ran the sales pipeline."],
  },
  {
    // Not case 3: leading recruitment is on the profile, under another role. Claiming it on this bullet attributes
    // another employer's work rather than promoting this one, which is invention as far as the cited facts go.
    finding: "6, a global entity does not support a relationship, and capitalisation changes nothing",
    author: "rules",
    case: "invention",
    bullet: "R1.8",
    cited: ["R1.8"],
    truthful: ["Built dashboards in Excel."],
    false: ["Led recruitment.", "Led RECRUITMENT.", "Reported ARPU in Excel."],
  },
  {
    finding: "D-021, rewordings that must keep passing",
    author: "rules",
    case: "invention",
    bullet: "R1.10",
    cited: ["R1.10"],
    truthful: ["Led the pricing review across 3 markets.", "Ran pricing reviews across three markets."],
    false: ["Ran the pricing review across 30 markets.", "Ran the pricing review across 3 regions."],
  },
];

const level = (bullet: string, line: string, cited: string[], facts = set, post = posting) => {
  const f = checkLine(line, bullet, cited, facts, post);
  return f.some((x) => x.level === "hard") ? "invalid" : f.some((x) => x.level === "review") ? "needs_review" : "ready";
};

/*
 * The second author's fourteen, on one profile as they were written. Recorded,
 * never asserted: every one of them passes, before the removal and after it.
 */
const FOURTEEN_ROLES: string[][] = [
  [
    "Reduced customer churn by 11 percent and cut acquisition cost by 5 percent.",
    "Managed 6 junior analysts.",
    "Negotiated 3 deals.",
    "Reviewed budgets annually and reduced costs by 11 percent.",
    "Reviewed budgets annually and reviewed costs.",
    "Did not join in January 2023.",
    "Managed a team in 2000.",
    "Did not manage recruitment.",
    "Supported recruitment of analysts.",
    "Built dashboards in Excel.",
    "Built 6 dashboards in Excel.",
    "Certified in Excel.",
  ],
  ["Used Salesforce."],
];

const FOURTEEN_FACTS: ResumeFacts = {
  ...FACTS,
  employment: FOURTEEN_ROLES.map((bullets, i) => ({
    company: i === 0 ? "Arvento" : "Deloitte",
    title: i === 0 ? "Head of Strategy" : "Consultant",
    start: i === 0 ? "2022-03" : "2019-06",
    ...(i === 0 ? {} : { end: "2022-02" }),
    bullets,
  })),
  education: [],
  skills: [],
  sources: { employment: FOURTEEN_ROLES.map(() => RESUME), education: [], skills: [] },
};
const fourteenSet = factSet(factEntries(FOURTEEN_FACTS));

interface Counter {
  id: string;
  case: Case;
  bullet: string;
  line: string;
  /** The reviewer used an empty posting for 5a, which is what made it the case it is. */
  emptyPosting?: boolean;
}

const FOURTEEN: Counter[] = [
  { id: "1a", case: "case 2", bullet: "R1.1", line: "Reduced customer acquisition cost by 11 percent." },
  { id: "1b", case: "case 3", bullet: "R1.2", line: "Managed 6 senior analysts." },
  { id: "1c", case: "case 3", bullet: "R1.3", line: "Closed 3 deals." },
  { id: "2a", case: "case 2", bullet: "R1.4", line: "Reduced costs by 11 percent annually." },
  { id: "2b", case: "case 2", bullet: "R1.5", line: "Reviewed costs annually." },
  { id: "3a", case: "polarity", bullet: "R1.6", line: "Joined in 2023." },
  { id: "3b", case: "case 2", bullet: "R1.7", line: "Managed a team and 2000 customers." },
  { id: "4a", case: "polarity", bullet: "R1.8", line: "Managed recruitment." },
  { id: "4b", case: "case 3", bullet: "R1.9", line: "Led recruitment of analysts." },
  { id: "4c", case: "case 2", bullet: "R1.10", line: "Used Salesforce." },
  { id: "4d", case: "case 2", bullet: "R1.11", line: "Built 6 dashboards using Salesforce." },
  { id: "4e", case: "case 2", bullet: "R1.10", line: "Built dashboards in Excel and Salesforce." },
  { id: "5a", case: "invention", bullet: "R1.10", line: "Built dashboards using salesforce data.", emptyPosting: true },
  { id: "5b", case: "case 2", bullet: "R2.1", line: "Certified in Salesforce." },
];

/*
 * The false lines the code still catches at all, rejected or held, named one by
 * one. This is the whole of what it catches out of the 28, and it is asserted
 * so the check cannot quietly stop working. Most of these are held rather than
 * rejected: only a value in no confirmed fact rejects a packet (D-036). Every
 * other false line in this file is the prompt's responsibility.
 */
const STILL_CAUGHT = new Set([
  "Presented reports quarterly.",
  "Grew the team from 4 to 19 people.",
  "Ran a conjoint study of 2,000 customers that lifted ARPU 16 percent.",
  "Built dashboards using Tableau.",
  "Built dashboards and recruitment systems.",
  "Certified in Salesforce.",
  "Salesforce certified, ran the sales pipeline.",
  "Ran the pricing review across 30 markets.",
]);

describe("paired evaluation set", () => {
  it("passes every truthful line: removing a rule cannot create a false positive, and this is what says so", () => {
    const held: string[] = [];
    let caseOne = 0;
    for (const p of PAIRS) {
      for (const line of p.truthful) {
        caseOne += 1;
        const l = level(p.bullet, line, p.cited);
        if (l !== "ready") held.push(`case 1 ${p.finding}: "${line}" ${l}`);
      }
    }
    expect(caseOne).toBe(26);
    expect(held).toEqual([]);
  });

  it("still catches the false lines the check reaches, rejected or held, each named", () => {
    const missed: string[] = [];
    for (const p of PAIRS) {
      for (const entry of p.false) {
        const line = typeof entry === "string" ? entry : entry.line;
        if (!STILL_CAUGHT.has(line)) continue;
        if (level(p.bullet, line, p.cited) === "ready") missed.push(`${p.finding}: "${line}" is no longer caught at all`);
      }
    }
    expect(missed).toEqual([]);
  });

  it("records what the prompt is responsible for, and asserts nothing about it", () => {
    const blank = () => ({ falseLines: 0, rejected: 0, held: 0 });
    const byAuthor: Record<Author, ReturnType<typeof blank>> = { rules: blank(), independent: blank() };
    const byCase: Record<Case, ReturnType<typeof blank>> = { "case 2": blank(), "case 3": blank(), invention: blank(), polarity: blank() };
    const passing: string[] = [];
    const count = (tallies: ReturnType<typeof blank>[], l: string, label: string) => {
      for (const a of tallies) a.falseLines += 1;
      if (l === "invalid") for (const a of tallies) a.rejected += 1;
      else if (l === "needs_review") for (const a of tallies) a.held += 1;
      else passing.push(label);
    };
    for (const p of PAIRS) {
      for (const entry of p.false) {
        const line = typeof entry === "string" ? entry : entry.line;
        const kind = typeof entry === "string" ? p.case : entry.case;
        count([byAuthor[p.author], byCase[kind]], level(p.bullet, line, p.cited), `${kind}: "${line}" (${p.finding})`);
      }
    }
    for (const c of FOURTEEN) {
      const post = c.emptyPosting ? new Set<string>() : posting;
      count([byAuthor.independent, byCase[c.case]], level(c.bullet, c.line, [c.bullet], fourteenSet, post), `${c.case}: "${c.line}" (reviewer ${c.id})`);
    }
    // Rejected and held are counted apart, because they are not the same thing and D-036 turns on the difference:
    // a rejected packet loses its tailored resume, a held one keeps it and waits for a person.
    for (const author of ["rules", "independent"] as const) {
      const a = byAuthor[author];
      console.log(`by author, ${author}: ${a.rejected} of ${a.falseLines} false lines rejected, ${a.held} held for a person`);
    }
    for (const c of ["case 2", "case 3", "invention", "polarity"] as const) {
      const a = byCase[c];
      console.log(`by case, ${c}: ${a.rejected} of ${a.falseLines} rejected, ${a.held} held`);
    }
    console.log(`\n${passing.length} false lines are neither rejected nor held. The tailoring prompt is the only thing between these and a submitted resume:`);
    for (const s of passing) console.log(`  ${s}`);
    // Deliberately no expectation on `passing`. Asserting it would turn a record of what is
    // not checked into a claim that it is checked, which is the thing this file must not say.
    expect(byAuthor.rules.falseLines + byAuthor.independent.falseLines).toBe(42);
  });
});
