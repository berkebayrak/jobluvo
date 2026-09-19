import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { PacketFinding } from "@/db/schema";
import { parseFlags } from "@/lib/cli";
import type { ResumeFacts } from "@/server/match/profile";
import { readAnswers } from "@/server/packet/answers";
import { codeOf, type FindingCode } from "@/server/packet/codes";
import { lemmasOf } from "@/server/packet/entities";
import { baseResume, factEntries, resumeHash, shapedResume, type ChangeSet } from "@/server/packet/resume";
import { checkLine, factSet, isHard, needsReview, validateChangeSet, type FactSet } from "@/server/packet/validate";

/*
 * What the validator would say if only the cheap check survived.
 *
 * Measurement only. Nothing here changes a rule, and nothing is written: the
 * snapshot is read, the saved answers are re-read under the rules as they
 * stand, and the same findings are then counted again with every meaning
 * comparison removed. Two numbers come out, and they are the two the decision
 * needs before any code moves.
 *
 *   npm run probe-cheap-check
 *
 * The cheap check, in the user's words: a value or an entity that appears
 * nowhere in the confirmed facts is a hard finding. That is one lookup against
 * the whole profile. It is not a comparison of what a line means against what
 * a fact means, and every rule that is such a comparison comes out.
 */

type Status = "ready" | "needs_review" | "invalid";

/*
 * Case 0, invention: the value or entity is in NO confirmed fact at all.
 * These four ask exactly that and nothing else, so these four stay.
 */
const INVENTION: FindingCode[] = ["value-unknown", "name-unknown", "posting-word-unknown", "qualification-unsupported"];

/*
 * Not meaning comparisons at all: the change set names a line the resume does
 * not have, names one twice, or empties it. Kept because removing them is a
 * different decision from the one being taken, and because nothing about them
 * reads a line back to argue with it.
 */
const INTEGRITY: FindingCode[] = ["line-missing", "line-edited-twice", "empty-line", "skill-missing"];

/* Written by the replay and the run rather than the validator. Untouched here. */
const OUTSIDE: FindingCode[] = ["summary-not-revalidated", "profile-not-reproducible", "posting-moved", "unverifiable-resume", "retry-provenance"];

/*
 * Citation existence: the line cited nothing, or cited an id the profile does
 * not have. Not a meaning comparison, so not obviously in scope. But with the
 * comparisons gone a citation has nothing left to be checked against, so
 * whether it survives is a real question and is measured both ways rather than
 * decided here. "wrong-role", the employer rule, is NOT in this set: the user
 * named it as going.
 */
const CITATION_EXISTS: FindingCode[] = ["no-fact-cited", "cited-fact-missing"];

const CHEAP = new Set<string>([...INVENTION, ...INTEGRITY, ...OUTSIDE]);
const CHEAP_PLUS_CITES = new Set<string>([...CHEAP, ...CITATION_EXISTS]);

const statusOf = (f: PacketFinding[]): Status => (isHard(f) ? "invalid" : needsReview(f) ? "needs_review" : "ready");

/** The same findings, counted with only the codes a keep set names. */
function statusUnder(findings: PacketFinding[], keep: Set<string>): Status {
  return statusOf(findings.filter((f) => {
    const c = codeOf(f);
    return c !== null && keep.has(c);
  }));
}

const RESUME = { rowId: "r", origin: "upload" as const, hasEvidence: true };

/** A profile of one or two roles, bullets in order, so a counterexample can carry the exact fact it was written against. */
function profileOf(roles: string[][]): FactSet {
  const facts: ResumeFacts = {
    userId: "u",
    prefs: { targetCountries: ["US"], relocation: "yes", remote: "remote_ok" },
    employment: roles.map((bullets, i) => ({
      company: i === 0 ? "Arvento" : "Deloitte",
      title: i === 0 ? "Head of Strategy" : "Consultant",
      start: i === 0 ? "2022-03" : "2019-06",
      ...(i === 0 ? {} : { end: "2022-02" }),
      bullets,
    })),
    education: [],
    skills: [],
    answers: [],
    sources: { employment: roles.map(() => RESUME), education: [], skills: [] },
    prefsHash: "p",
    factsHash: "f",
  };
  return factSet(factEntries(facts));
}

// ---------------------------------------------------------------------------
// Part 1: the hold rate on the 80 saved answers.
// ---------------------------------------------------------------------------

type SavedOutcome = { jobId: string; attemptLog: (string | { outcome: string })[]; changeSets: (ChangeSet | null)[]; posting: string[] };
const outcomeOf = (a: string | { outcome: string }) => (typeof a === "string" ? a : a.outcome);

/** The attempt the run keeps (src/server/packet/run.ts), copied from reconcile-sample. */
function retainedIndex(outcomes: string[]): number {
  const last = outcomes.length - 1;
  const before = outcomes[last - 1];
  return before === "needs_review" && (outcomes[last] === "invalid" || outcomes[last] === "failed") ? last - 1 : last;
}

function holdRate(dir: string, run: string) {
  const read = <T>(name: string): T => JSON.parse(readFileSync(join(dir, name), "utf8")) as T;
  const answersFile = readAnswers(readFileSync(join(dir, "families-18sep-saved-answers.json"), "utf8"));
  const saved = answersFile.outcomes as unknown as SavedOutcome[];
  const header = answersFile.header;
  const profiles = read<Record<string, { facts: ResumeFacts; baseResumeShapeHash: string }>>("profiles.json");
  // These answers were written before a sample recorded its own header (finding
  // 18), so the profile comes from the run's packets, exactly as reconcile-sample
  // takes it, rather than being guessed.
  const packets = read<{ run: string; factsHash: string }[]>("packets.json").filter((p) => p.run === run);
  const hashes = [...new Set(packets.map((p) => p.factsHash))];
  if (hashes.length !== 1) throw new Error(`the run's packets sit on ${hashes.length} profiles: ${hashes.join(", ")}`);
  const factsHash = header?.factsHash ?? hashes[0]!;
  if (header && header.factsHash !== hashes[0]) throw new Error("the answers' header and the packets disagree about the profile");
  const profile = profiles[factsHash];
  if (!profile) throw new Error(`profiles.json has no profile for ${factsHash}`);
  const facts = profile.facts;
  const base = baseResume(facts);
  const set = factSet(factEntries(facts));
  if (resumeHash(shapedResume(base)) !== profile.baseResumeShapeHash) throw new Error("the base resume rebuilt here is not the snapshot's");
  if (header && resumeHash(base) !== header.baseResumeHash) throw new Error("the base resume is not the one the answers edit");
  console.log(`\nThe answers carry ${header ? "a header" : "no header, so the profile is taken from the run's packets"}: profile ${factsHash.slice(0, 12)}, ${factEntries(facts).length} facts, run ${run}.`);

  const tally = { now: { ready: 0, needs_review: 0, invalid: 0 }, cheap: { ready: 0, needs_review: 0, invalid: 0 }, cheapPlus: { ready: 0, needs_review: 0, invalid: 0 } };
  const firedNow = new Map<string, number>();
  const firedCheap = new Map<string, number>();
  let noAnswer = 0;

  for (const o of saved) {
    const retained = retainedIndex(o.attemptLog.map(outcomeOf));
    const cs = o.changeSets[retained];
    if (!cs) {
      noAnswer += 1;
      continue;
    }
    const findings = validateChangeSet(cs, base, set, new Set(o.posting));
    for (const f of findings) {
      if (f.level === "soft") continue;
      const c = codeOf(f);
      if (c === null) throw new Error(`a freshly computed finding has no code: ${f.message}`);
      firedNow.set(c, (firedNow.get(c) ?? 0) + 1);
      if (CHEAP.has(c)) firedCheap.set(c, (firedCheap.get(c) ?? 0) + 1);
    }
    tally.now[statusOf(findings)] += 1;
    tally.cheap[statusUnder(findings, CHEAP)] += 1;
    tally.cheapPlus[statusUnder(findings, CHEAP_PLUS_CITES)] += 1;
  }

  const n = saved.length - noAnswer;
  console.log(`\n## 1. Hold rate on the ${saved.length} saved answers, retained attempt, profile ${factsHash.slice(0, 12)}`);
  console.log(`${n} answers have a retained change set; ${noAnswer} do not and are left out of the rates.\n`);
  console.log("| Rules | Ready | Held | Invalid | Held or invalid |");
  console.log("|---|---|---|---|---|");
  const row = (label: string, t: { ready: number; needs_review: number; invalid: number }) =>
    console.log(`| ${label} | ${t.ready} | ${t.needs_review} | ${t.invalid} | ${(((t.needs_review + t.invalid) / n) * 100).toFixed(1)} percent |`);
  row("As they stand now", tally.now);
  row("Cheap check only", tally.cheap);
  row("Cheap check plus citation existence", tally.cheapPlus);

  console.log("\n### Which findings fire, over those answers (hard and review only, one count per finding)\n");
  console.log("| Code | Now | Under the cheap check |");
  console.log("|---|---|---|");
  for (const [code, count] of [...firedNow].sort((a, b) => b[1] - a[1])) {
    console.log(`| ${code} | ${count} | ${firedCheap.get(code) ?? 0} |`);
  }
}

// ---------------------------------------------------------------------------
// Part 2a: the 32 unsupported lines already in pairs.test.ts, plus the 18 labelled supported and the 4 pending.
// Copied from src/server/packet/pairs.test.ts. The copy is checked below by
// reproducing that file's published counts before anything is removed.
// ---------------------------------------------------------------------------

type Case = "case 2" | "case 3" | "invention" | "polarity";
type FalseLine = string | { line: string; case: Case };
interface Pair {
  finding: string;
  case: Case;
  bullet: string;
  cited: string[];
  truthful: string[];
  /** Lines nobody has placed: counted and reported, never asserted about (D-052). */
  pending?: string[];
  false: FalseLine[];
}

const PAIR_FACTS: ResumeFacts = {
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

const PAIR_SET = factSet(factEntries(PAIR_FACTS));
const PAIR_POSTING = lemmasOf("Salesforce, recruitment systems, dashboards, analytics");

const PAIRS: Pair[] = [
  { finding: "3A, a value paired with a sibling value's measure", case: "case 2", bullet: "R1.1", cited: ["R1.1"], truthful: ["Cut churn 11 percent and reduced acquisition cost 5 percent.", "Reduced churn by 11 percent while cutting acquisition cost by 5 percent."], false: ["Reduced acquisition cost 11 percent.", "Cut churn 5 percent."] },
  { finding: "3B, the opening verb is a relationship", case: "case 3", bullet: "R1.2", cited: ["R1.2"], truthful: ["Trained six analysts."], pending: ["Coached 6 analysts."], false: ["Managed 6 analysts.", { line: "Hired 6 analysts.", case: "invention" }] },
  { finding: "3C, a denial", case: "polarity", bullet: "R1.3", cited: ["R1.3"], truthful: ["Did not manage the 6 analysts."], false: ["Managed 6 analysts."] },
  { finding: "3D, a change against a level", case: "case 2", bullet: "R1.4", cited: ["R1.4"], truthful: ["Cut churn by 11 percent.", "Reduced churn by about 11 percent."], false: ["Reduced churn to 11 percent.", "Held churn at 11 percent."] },
  { finding: "3E, the sign", case: "polarity", bullet: "R1.5", cited: ["R1.5"], truthful: ["Revenue growth of -11 percent.", "Achieved revenue growth of -11 percent."], false: ["Achieved 11 percent revenue growth."] },
  { finding: "4A, the frequency of a period", case: "case 2", bullet: "R1.6", cited: ["R1.6"], truthful: ["Presented reports twice yearly.", "Presented reports 2 times a year."], false: ["Presented reports once a year.", "Presented reports annually.", "Presented reports quarterly."] },
  { finding: "4B, a period bound to its predicate", case: "case 2", bullet: "R1.7", cited: ["R1.7"], truthful: ["Cut costs by 11 percent and reviewed budgets annually.", "Reviewed budgets annually; cut costs by 11 percent."], false: ["Cut costs by 11 percent annually."] },
  { finding: "7, numbers the normaliser reads", case: "invention", bullet: "R1.9", cited: ["R1.9"], truthful: ["Grew the team from four to nine people.", "Grew the team from 4 to 9 people."], false: ["Grew the team from 4 to 19 people.", "Grew the team to 4 people."] },
  { finding: "a four digit count is not a year", case: "invention", bullet: "R2.3", cited: ["R2.3"], truthful: ["Delivered 9 growth projects for banks, with a study of 2,000 customers."], false: ["Ran a conjoint study of 2,000 users that lifted ARPU 6 percent.", "Ran a conjoint study of 2,000 customers that lifted ARPU 16 percent.", { line: "Ran a conjoint study of 2000 customers that lifted ARPU 6 percent.", case: "case 3" }] },
  { finding: "5A, the tool after using or in is a claim", case: "invention", bullet: "R1.8", cited: ["R1.8"], truthful: ["Built Excel dashboards."], pending: ["Built dashboards with attention to detail."], false: ["Built dashboards using salesforce data.", "Built dashboards using Tableau.", "Built dashboards in Salesforce.", { line: "Built dashboards in Excel for the sales team.", case: "invention" }] },
  { finding: "5B, every conjunct of a coordinated object", case: "invention", bullet: "R1.8", cited: ["R1.8"], truthful: [], false: ["Built dashboards and recruitment systems.", "Built dashboards and pricing models in Excel.", { line: "Built dashboards and reports in Excel.", case: "invention" }] },
  { finding: "5C, a qualification", case: "invention", bullet: "R2.1", cited: ["R2.1"], truthful: ["Worked in Salesforce for the sales pipeline."], false: ["Certified in Salesforce.", "Salesforce certified, ran the sales pipeline.", { line: "Used Salesforce to run the sales pipeline.", case: "case 3" }] },
  { finding: "6, a global entity does not support a relationship", case: "invention", bullet: "R1.8", cited: ["R1.8"], truthful: ["Built dashboards in Excel."], false: ["Led recruitment.", "Led RECRUITMENT.", "Reported ARPU in Excel."] },
  { finding: "D-021, rewordings that must keep passing", case: "invention", bullet: "R1.10", cited: ["R1.10"], truthful: [], pending: ["Led the pricing review across 3 markets.", "Ran pricing reviews across three markets."], false: ["Ran the pricing review across 30 markets.", "Ran the pricing review across 3 regions."] },
];

function pairsTable() {
  const byCase = new Map<Case, { lines: number; now: number; cheap: number }>();
  const nowPassing: string[] = [];
  let caseOne = 0;
  let caseOnePassed = 0;
  for (const p of PAIRS) {
    for (const entry of p.false) {
      const line = typeof entry === "string" ? entry : entry.line;
      const kind = typeof entry === "string" ? p.case : entry.case;
      const f = checkLine(line, p.bullet, p.cited, PAIR_SET, PAIR_POSTING);
      const t = byCase.get(kind) ?? { lines: 0, now: 0, cheap: 0 };
      t.lines += 1;
      if (statusOf(f) !== "ready") t.now += 1;
      if (statusUnder(f, CHEAP) !== "ready") t.cheap += 1;
      else if (statusOf(f) !== "ready") nowPassing.push(`${kind}: "${line}" (${p.finding})`);
      byCase.set(kind, t);
    }
    for (const line of p.truthful) {
      caseOne += 1;
      if (statusOf(checkLine(line, p.bullet, p.cited, PAIR_SET, PAIR_POSTING)) === "ready") caseOnePassed += 1;
    }
  }
  console.log("\n## 2a. The 32 false lines already in pairs.test.ts, and what the validator does with them\n");
  console.log("| Case | False lines | Caught now | Caught by the cheap check |");
  console.log("|---|---|---|---|");
  let lines = 0;
  let now = 0;
  let cheap = 0;
  for (const c of ["invention", "case 2", "case 3", "polarity"] as const) {
    const t = byCase.get(c);
    if (!t) continue;
    console.log(`| ${c} | ${t.lines} | ${t.now} | ${t.cheap} |`);
    lines += t.lines;
    now += t.now;
    cheap += t.cheap;
  }
  console.log(`| all | ${lines} | ${now} | ${cheap} |`);
  console.log(`\nlines labelled supported, which must keep passing: ${caseOnePassed} of ${caseOne} pass now.`);
  const pendingLines = PAIRS.flatMap((x) => (x.pending ?? []).map((line) => ({ p: x, line })));
  console.log(`\n${pendingLines.length} lines are pending adjudication (D-052). Reported, never asserted:\n`);
  console.log("| Line | Today |");
  console.log("|---|---|");
  for (const { p: x, line } of pendingLines) console.log(`| ${line} | ${statusOf(checkLine(line, x.bullet, x.cited, PAIR_SET, PAIR_POSTING))} |`);
  console.log(`\nThe ${nowPassing.length} lines that stop being caught:`);
  for (const s of nowPassing) console.log(`  - ${s}`);
  return { lines, now, cheap, caseOne, caseOnePassed, pending: PAIRS.reduce((n, x) => n + (x.pending?.length ?? 0), 0) };
}

// ---------------------------------------------------------------------------
// Part 2b: the reviewer's fourteen, which are NOT in pairs.test.ts and which
// the validator misses today. Each carries the fact it was written against.
// ---------------------------------------------------------------------------

/*
 * One profile for all fourteen, not one per line, because that is what the
 * reviewer used and the difference decides several of them. On a profile
 * holding only the cited fact, "Salesforce" is in no fact at all and 4d, 4e
 * and 5a are caught as plain invention, which is not what the reviewer
 * reported. Salesforce is on this profile under the other role, so those three
 * turn on whether the line means what the CITED fact means, which is the point
 * they were written to make.
 */
const FOURTEEN_ROLES: string[][] = [
  [
    "Reduced customer churn by 11 percent and cut acquisition cost by 5 percent.", // R1.1
    "Managed 6 junior analysts.", // R1.2
    "Negotiated 3 deals.", // R1.3
    "Reviewed budgets annually and reduced costs by 11 percent.", // R1.4
    "Reviewed budgets annually and reviewed costs.", // R1.5
    "Did not join in January 2023.", // R1.6
    "Managed a team in 2000.", // R1.7
    "Did not manage recruitment.", // R1.8
    "Supported recruitment of analysts.", // R1.9
    "Built dashboards in Excel.", // R1.10
    "Built 6 dashboards in Excel.", // R1.11
    "Certified in Excel.", // R1.12, the other role's line for 5b
  ],
  ["Used Salesforce."], // R2.1
];

const FOURTEEN_SET = profileOf(FOURTEEN_ROLES);

interface Counter {
  id: string;
  /** My label, not the reviewer's: what the line does to the claim. */
  case: Case;
  fact: string;
  bullet: string;
  cited: string[];
  line: string;
  posting?: string;
}

const FOURTEEN: Counter[] = [
  { id: "1a", case: "case 2", fact: "R1.1", bullet: "R1.1", cited: ["R1.1"], line: "Reduced customer acquisition cost by 11 percent." },
  { id: "1b", case: "case 3", fact: "R1.2", bullet: "R1.2", cited: ["R1.2"], line: "Managed 6 senior analysts." },
  { id: "1c", case: "case 3", fact: "R1.3", bullet: "R1.3", cited: ["R1.3"], line: "Closed 3 deals." },
  { id: "2a", case: "case 2", fact: "R1.4", bullet: "R1.4", cited: ["R1.4"], line: "Reduced costs by 11 percent annually." },
  { id: "2b", case: "case 2", fact: "R1.5", bullet: "R1.5", cited: ["R1.5"], line: "Reviewed costs annually." },
  { id: "3a", case: "polarity", fact: "R1.6", bullet: "R1.6", cited: ["R1.6"], line: "Joined in 2023." },
  { id: "3b", case: "case 2", fact: "R1.7", bullet: "R1.7", cited: ["R1.7"], line: "Managed a team and 2000 customers." },
  { id: "4a", case: "polarity", fact: "R1.8", bullet: "R1.8", cited: ["R1.8"], line: "Managed recruitment." },
  { id: "4b", case: "case 3", fact: "R1.9", bullet: "R1.9", cited: ["R1.9"], line: "Led recruitment of analysts." },
  { id: "4c", case: "case 2", fact: "R1.10", bullet: "R1.10", cited: ["R1.10"], line: "Used Salesforce." },
  { id: "4d", case: "case 2", fact: "R1.11", bullet: "R1.11", cited: ["R1.11"], line: "Built 6 dashboards using Salesforce." },
  { id: "4e", case: "case 2", fact: "R1.10", bullet: "R1.10", cited: ["R1.10"], line: "Built dashboards in Excel and Salesforce." },
  { id: "5a", case: "invention", fact: "R1.10", bullet: "R1.10", cited: ["R1.10"], line: "Built dashboards using salesforce data.", posting: "" },
  { id: "5b", case: "case 2", fact: "R2.1", bullet: "R2.1", cited: ["R2.1"], line: "Certified in Salesforce." },
];

/** The text of a bullet id on the fourteen's profile, for printing the fact beside the line. */
function factText(id: string): string {
  const [r, b] = id.slice(1).split(".").map(Number);
  return FOURTEEN_ROLES[r - 1][b - 1];
}

/* The sign case, kept per dash character because the three behave differently. */
const SIGNS: { id: string; dash: string; name: string }[] = [
  { id: "sign-hyphen", dash: "-", name: "hyphen minus" },
  { id: "sign-endash", dash: "–", name: "en dash" },
  { id: "sign-figure", dash: "‒", name: "figure dash" },
];

function fourteenTable() {
  console.log("\n## 2b. The reviewer's fourteen, which are not in pairs.test.ts\n");
  console.log("| # | Case | Fact | Tailored line | Now | Cheap check | What fires now |");
  console.log("|---|---|---|---|---|---|---|");
  let now = 0;
  let cheap = 0;
  for (const c of FOURTEEN) {
    const posting = c.posting === undefined ? PAIR_POSTING : lemmasOf(c.posting);
    const f = checkLine(c.line, c.bullet, c.cited, FOURTEEN_SET, posting);
    const a = statusOf(f) !== "ready";
    const b = statusUnder(f, CHEAP) !== "ready";
    if (a) now += 1;
    if (b) cheap += 1;
    const codes = f.filter((x) => x.level !== "soft").map((x) => `${codeOf(x)} (${x.level})`).join(", ") || "nothing fires";
    console.log(`| ${c.id} | ${c.case} | ${factText(c.fact)} | ${c.line} | ${a ? "caught" : "passes"} | ${b ? "caught" : "passes"} | ${codes} |`);
  }
  console.log(`| all | | | | ${now} of ${FOURTEEN.length} | ${cheap} of ${FOURTEEN.length} |`);

  console.log("\n### The sign case, one row per dash character\n");
  console.log("| Dash | Fact | Tailored line | Now | Cheap check | What fires now |");
  console.log("|---|---|---|---|---|---|");
  for (const s of SIGNS) {
    const fact = `Achieved ${s.dash}11 percent revenue growth.`;
    const line = "Achieved 11 percent revenue growth.";
    const set = profileOf([[fact]]);
    const f = checkLine(line, "R1.1", ["R1.1"], set, PAIR_POSTING);
    const codes = f.filter((x) => x.level !== "soft").map((x) => `${codeOf(x)} (${x.level})`).join(", ") || "nothing fires";
    console.log(`| ${s.name} | ${fact} | ${line} | ${statusOf(f) !== "ready" ? "caught" : "passes"} | ${statusUnder(f, CHEAP) !== "ready" ? "caught" : "passes"} | ${codes} |`);
  }
  return { now, cheap };
}

function main() {
  const { values } = parseFlags(process.argv.slice(2), { booleans: [] as const, values: ["dir", "run"] as const });
  const dir = values.dir ?? "design/snapshots/2026-09-18-packets";
  const run = values.run ?? "families-18sep-changes";
  console.log(`# What the validator says with only the cheap check\n\nRead from ${dir}. Nothing written. The cheap check keeps: ${INVENTION.join(", ")}, plus the change set integrity codes and the codes the replay and the run write.`);
  holdRate(dir, run);
  const p = pairsTable();
  // The copy of pairs.test.ts above must still hold that file's 32 false lines and
  // 22 truthful ones, or the copy has drifted and every number under it is worthless.
  // The caught count is not 32: that is the measurement, not a drift.
  //
  // This guard compares the copy with a constant, not with pairs.test.ts, so it can only
  // catch an edit to the copy and never an edit to the file the copy mirrors. D-044 moved
  // two lines in that file and this guard passed unchanged, which is exactly the failure it
  // reads as though it prevents. Placed in phase 1 with the other measurement defects.
  if (p.lines !== 32 || p.caseOne !== 18 || p.pending !== 4) {
    throw new Error(`the copy of pairs.test.ts has drifted: ${p.lines} false lines, ${p.caseOne} supported and ${p.pending} pending, expected 32, 18 and 4`);
  }
  console.log(`
The copy holds 32 unsupported lines, 18 labelled supported and 4 pending, which is what pairs.test.ts held when this constant was last set by hand. The guard compares the copy with that constant and not with the file, so it cannot see an edit to the file. Flagged: ${p.cheap} of 32. Supported lines passing: ${p.caseOnePassed} of 18. The 4 pending are reported above and asserted about nowhere.`);
  fourteenTable();
}

main();
