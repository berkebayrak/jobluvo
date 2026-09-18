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
 * Each case names the review finding it came from. Add a pair whenever a
 * miss is found in the wild; never remove one.
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

interface Pair {
  finding: string;
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
    bullet: "R1.1",
    cited: ["R1.1"],
    truthful: ["Cut churn 11 percent and reduced acquisition cost 5 percent.", "Reduced churn by 11 percent while cutting acquisition cost by 5 percent."],
    false: ["Reduced acquisition cost 11 percent.", "Cut churn 5 percent."],
  },
  {
    finding: "3B, the opening verb is a relationship",
    bullet: "R1.2",
    cited: ["R1.2"],
    truthful: ["Coached 6 analysts.", "Trained six analysts."],
    false: ["Managed 6 analysts.", "Hired 6 analysts."],
  },
  {
    finding: "3C, a denial",
    bullet: "R1.3",
    cited: ["R1.3"],
    truthful: ["Did not manage the 6 analysts."],
    false: ["Managed 6 analysts."],
  },
  {
    finding: "3D, a change against a level",
    bullet: "R1.4",
    cited: ["R1.4"],
    truthful: ["Cut churn by 11 percent.", "Reduced churn by about 11 percent."],
    false: ["Reduced churn to 11 percent.", "Held churn at 11 percent."],
  },
  {
    finding: "3E, the sign",
    bullet: "R1.5",
    cited: ["R1.5"],
    truthful: ["Revenue growth of -11 percent.", "Achieved revenue growth of -11 percent."],
    false: ["Achieved 11 percent revenue growth."],
  },
  {
    finding: "4A, the frequency of a period",
    bullet: "R1.6",
    cited: ["R1.6"],
    truthful: ["Presented reports twice yearly.", "Presented reports 2 times a year."],
    false: ["Presented reports once a year.", "Presented reports annually.", "Presented reports quarterly."],
  },
  {
    finding: "4B, a period bound to its predicate",
    bullet: "R1.7",
    cited: ["R1.7"],
    truthful: ["Cut costs by 11 percent and reviewed budgets annually.", "Reviewed budgets annually; cut costs by 11 percent."],
    false: ["Cut costs by 11 percent annually."],
  },
  {
    finding: "7, numbers the normaliser reads",
    bullet: "R1.9",
    cited: ["R1.9"],
    truthful: ["Grew the team from four to nine people.", "Grew the team from 4 to 9 people."],
    false: ["Grew the team from 4 to 19 people.", "Grew the team to 4 people."],
  },
  {
    finding: "a four digit count is not a year",
    bullet: "R2.3",
    cited: ["R2.3"],
    truthful: ["Delivered 9 growth projects for banks, with a study of 2,000 customers.", "Ran a conjoint study of 2000 customers that lifted ARPU 6 percent."],
    false: ["Ran a conjoint study of 2,000 users that lifted ARPU 6 percent.", "Ran a conjoint study of 2,000 customers that lifted ARPU 16 percent."],
  },
  {
    finding: "D-021, rewordings that must keep passing",
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
    let falseLines = 0;
    let truthfulLines = 0;
    for (const p of PAIRS) {
      for (const line of p.false) {
        falseLines += 1;
        if (level(p.bullet, line, p.cited) === "ready") misses.push(`${p.finding}: "${line}" passed`);
      }
      for (const line of p.truthful) {
        truthfulLines += 1;
        const l = level(p.bullet, line, p.cited);
        if (l !== "ready") falseHolds.push(`${p.finding}: "${line}" ${l} ${JSON.stringify(checkLine(line, p.bullet, p.cited, set, posting).filter((f) => f.level !== "soft").map((f) => [f.message, f.value]))}`);
      }
    }
    console.log(`evaluation set: ${falseLines - misses.length} of ${falseLines} false lines caught (${misses.length} missed), ${truthfulLines - falseHolds.length} of ${truthfulLines} truthful lines passed`);
    expect(misses).toEqual([]);
    expect(falseHolds).toEqual([]);
  });
});
