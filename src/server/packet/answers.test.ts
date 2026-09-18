import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import type { ResumeDocument } from "@/db/schema";
import { answersHeader, readAnswers, writeAnswers, type SavedAnswer } from "./answers";
import { resumeHash } from "./resume";

/*
 * Finding 18. A sample's answers are the only copy of work that was paid
 * for, so the file has to survive a crash and has to say what produced it.
 */

const BASE: ResumeDocument = {
  summary: null,
  experience: [{ id: "R1", heading: "Head of Strategy, Arvento", bullets: [{ id: "R1.1", text: "Ran a cost program." }] }],
  education: [],
  skills: [{ id: "S1", text: "Strategy" }],
};

const header = answersHeader({
  run: "sample-2026-09-18-changes",
  startedAt: "2026-09-18T12:00:00.000Z",
  model: "gpt-5.6-luna",
  promptRevision: "2026-09-18.p2",
  validatorRevision: "2026-09-18.r5",
  factsHash: "facts-hash",
  baseResume: BASE,
  jobs: 3,
});

const answer = (jobId: string): SavedAnswer => ({ jobId, status: "ready", attempts: 1, selected: 0, usd: 0.0005, attemptLog: [], changeSets: [], posting: ["strategy"] });

let dir: string | null = null;
const temp = () => (dir = mkdtempSync(join(tmpdir(), "jobluvo-answers-")));
afterEach(() => {
  if (dir) rmSync(dir, { recursive: true, force: true });
  dir = null;
});

describe("saved answers carry what produced them and survive a run that dies", () => {
  it("writes the header with the base resume's hash and reads it back whole", () => {
    const path = join(temp(), "answers.json");
    writeAnswers(path, header, [answer("j1")]);
    const back = readAnswers(readFileSync(path, "utf8"));
    expect(back.header).toEqual(header);
    expect(back.header!.baseResumeHash).toBe(resumeHash(BASE));
    expect(back.outcomes.map((o) => o.jobId)).toEqual(["j1"]);
  });

  it("holds every answer finished before the run died, and nothing it had not reached", () => {
    const path = join(temp(), "answers.json");
    // What the sample does: rewrite after each outcome. The run dies after the second.
    const saved: SavedAnswer[] = [];
    for (const id of ["j1", "j2"]) {
      saved.push(answer(id));
      writeAnswers(path, header, saved);
    }
    const back = readAnswers(readFileSync(path, "utf8"));
    expect(back.outcomes.map((o) => o.jobId)).toEqual(["j1", "j2"]);
    // The header still says three jobs were meant, so a reader can see the file is short rather than assume it is whole.
    expect(back.header!.jobs).toBe(3);
  });

  it("leaves no temporary file behind, so a directory read never picks up a half written one", () => {
    const d = temp();
    const path = join(d, "answers.json");
    writeAnswers(path, header, [answer("j1")]);
    writeAnswers(path, header, [answer("j1"), answer("j2")]);
    expect(readdirSync(d)).toEqual(["answers.json"]);
    expect(existsSync(`${path}.writing`)).toBe(false);
  });

  it("reads a file from before headers existed as a null header, and never invents one", () => {
    const path = join(temp(), "old.json");
    writeFileSync(path, JSON.stringify([answer("j1"), answer("j2")]));
    const back = readAnswers(readFileSync(path, "utf8"));
    expect(back.header).toBeNull();
    expect(back.outcomes).toHaveLength(2);
  });

  it("refuses a file that is neither", () => {
    expect(() => readAnswers(JSON.stringify({ outcomes: [] }))).toThrow(/not a saved answers file/);
  });
});
