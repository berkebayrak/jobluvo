import { describe, expect, it } from "vitest";
import type { ResumeFacts } from "@/server/match/profile";
import { lemmasOf } from "./entities";
import { factEntries } from "./resume";
import { checkLine, factSet } from "./validate";

/*
 * The evaluation set (review four): paired lines against one profile, each
 * pair a truthful rewording that must pass and a false rewrite that must be
 * held or rejected. Every number this project produced before this file
 * counted how often the validator fired; this file counts how often it
 * should have fired and did not. A false line that passes is a miss, and
 * the miss rate is printed with the pass rate on the truthful lines.
 *
 * Each case names the review finding it came from and who wrote it, and the
 * second of those matters more than it looks. A set written by the person who
 * wrote the rules measures whether the rules do what that person meant. It
 * cannot measure what nobody thought of, and on 18 September 2026 that stopped
 * being a caveat and became a result: this set caught 28 of its own 28, and a
 * second author who had read the implementation wrote 14 false lines that the
 * validator missed, all 14. So the counts are printed by author, and a total
 * across both would hide the only number that has ever said anything about
 * what the validator lets past.
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

interface Pair {
  finding: string;
  author: Author;
  bullet: string;
  cited: string[];
  /** Lines that must pass with no hard or review finding. */
  truthful: string[];
  /** Lines that must be held or rejected. */
  false: string[];
}

const PAIRS: Pair[] = [
  {
    finding: "3A, a value paired with a sibling value's measure",
    author: "rules",
    bullet: "R1.1",
    cited: ["R1.1"],
    truthful: ["Cut churn 11 percent and reduced acquisition cost 5 percent.", "Reduced churn by 11 percent while cutting acquisition cost by 5 percent."],
    false: ["Reduced acquisition cost 11 percent.", "Cut churn 5 percent."],
  },
  {
    finding: "3B, the opening verb is a relationship",
    author: "rules",
    bullet: "R1.2",
    cited: ["R1.2"],
    truthful: ["Coached 6 analysts.", "Trained six analysts."],
    false: ["Managed 6 analysts.", "Hired 6 analysts."],
  },
  {
    finding: "3C, a denial",
    author: "rules",
    bullet: "R1.3",
    cited: ["R1.3"],
    truthful: ["Did not manage the 6 analysts."],
    false: ["Managed 6 analysts."],
  },
  {
    finding: "3D, a change against a level",
    author: "rules",
    bullet: "R1.4",
    cited: ["R1.4"],
    truthful: ["Cut churn by 11 percent.", "Reduced churn by about 11 percent."],
    false: ["Reduced churn to 11 percent.", "Held churn at 11 percent."],
  },
  {
    finding: "3E, the sign",
    author: "rules",
    bullet: "R1.5",
    cited: ["R1.5"],
    truthful: ["Revenue growth of -11 percent.", "Achieved revenue growth of -11 percent."],
    false: ["Achieved 11 percent revenue growth."],
  },
  {
    finding: "4A, the frequency of a period",
    author: "rules",
    bullet: "R1.6",
    cited: ["R1.6"],
    truthful: ["Presented reports twice yearly.", "Presented reports 2 times a year."],
    false: ["Presented reports once a year.", "Presented reports annually.", "Presented reports quarterly."],
  },
  {
    finding: "4B, a period bound to its predicate",
    author: "rules",
    bullet: "R1.7",
    cited: ["R1.7"],
    truthful: ["Cut costs by 11 percent and reviewed budgets annually.", "Reviewed budgets annually; cut costs by 11 percent."],
    false: ["Cut costs by 11 percent annually."],
  },
  {
    finding: "7, numbers the normaliser reads",
    author: "rules",
    bullet: "R1.9",
    cited: ["R1.9"],
    truthful: ["Grew the team from four to nine people.", "Grew the team from 4 to 9 people."],
    false: ["Grew the team from 4 to 19 people.", "Grew the team to 4 people."],
  },
  {
    finding: "a four digit count is not a year",
    author: "rules",
    bullet: "R2.3",
    cited: ["R2.3"],
    truthful: ["Delivered 9 growth projects for banks, with a study of 2,000 customers.", "Ran a conjoint study of 2000 customers that lifted ARPU 6 percent."],
    false: ["Ran a conjoint study of 2,000 users that lifted ARPU 6 percent.", "Ran a conjoint study of 2,000 customers that lifted ARPU 16 percent."],
  },
  {
    finding: "5A, the tool after using or in is a claim",
    author: "rules",
    bullet: "R1.8",
    cited: ["R1.8"],
    truthful: ["Built Excel dashboards.", "Built dashboards in Excel for the sales team.", "Built dashboards with attention to detail."],
    false: ["Built dashboards using salesforce data.", "Built dashboards using Tableau.", "Built dashboards in Salesforce."],
  },
  {
    finding: "5B, every conjunct of a coordinated object",
    author: "rules",
    bullet: "R1.8",
    cited: ["R1.8"],
    truthful: ["Built dashboards and reports in Excel."],
    false: ["Built dashboards and recruitment systems.", "Built dashboards and pricing models in Excel."],
  },
  {
    finding: "5C, a qualification",
    author: "rules",
    bullet: "R2.1",
    cited: ["R2.1"],
    truthful: ["Worked in Salesforce for the sales pipeline.", "Used Salesforce to run the sales pipeline."],
    false: ["Certified in Salesforce.", "Salesforce certified, ran the sales pipeline."],
  },
  {
    finding: "6, a global entity does not support a relationship, and capitalisation changes nothing",
    author: "rules",
    bullet: "R1.8",
    cited: ["R1.8"],
    truthful: ["Built dashboards in Excel."],
    false: ["Led recruitment.", "Led RECRUITMENT.", "Reported ARPU in Excel."],
  },
  {
    finding: "D-021, rewordings that must keep passing",
    author: "rules",
    bullet: "R1.10",
    cited: ["R1.10"],
    truthful: ["Led the pricing review across 3 markets.", "Ran pricing reviews across three markets."],
    false: ["Ran the pricing review across 30 markets.", "Ran the pricing review across 3 regions."],
  },
];

const level = (bullet: string, line: string, cited: string[]) => {
  const f = checkLine(line, bullet, cited, set, posting);
  return f.some((x) => x.level === "hard") ? "invalid" : f.some((x) => x.level === "review") ? "needs_review" : "ready";
};

describe("paired evaluation set", () => {
  it("catches every false line and passes every truthful one, and prints the miss rate", () => {
    const misses: string[] = [];
    const falseHolds: string[] = [];
    const tally: Record<Author, { falseLines: number; caught: number; truthful: number; passed: number }> = {
      rules: { falseLines: 0, caught: 0, truthful: 0, passed: 0 },
      independent: { falseLines: 0, caught: 0, truthful: 0, passed: 0 },
    };
    for (const p of PAIRS) {
      for (const line of p.false) {
        tally[p.author].falseLines += 1;
        if (level(p.bullet, line, p.cited) === "ready") misses.push(`${p.finding}: "${line}" passed`);
        else tally[p.author].caught += 1;
      }
      for (const line of p.truthful) {
        tally[p.author].truthful += 1;
        const l = level(p.bullet, line, p.cited);
        if (l !== "ready") falseHolds.push(`${p.finding}: "${line}" ${l} ${JSON.stringify(checkLine(line, p.bullet, p.cited, set, posting).filter((f) => f.level !== "soft").map((f) => [f.message, f.value]))}`);
        else tally[p.author].passed += 1;
      }
    }
    // By author, never summed: a total would let the rules' author's own cases carry the independent ones.
    for (const author of ["rules", "independent"] as const) {
      const t = tally[author];
      if (!t.falseLines && !t.truthful) {
        console.log(`evaluation set, ${author}: no cases yet`);
        continue;
      }
      console.log(`evaluation set, ${author}: ${t.caught} of ${t.falseLines} false lines caught, ${t.passed} of ${t.truthful} truthful lines passed`);
    }
    expect(misses).toEqual([]);
    expect(falseHolds).toEqual([]);
  });
});
