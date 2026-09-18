import { renameSync, writeFileSync } from "node:fs";
import type { ResumeDocument } from "@/db/schema";
import type { TailorOutcome } from "./run";
import { resumeHash } from "./resume";

/*
 * The file a sample writes so a rule can be re-read on the same answers
 * without paying for them again (review four, finding 18).
 *
 * Two things were wrong with it, and the first is the expensive one.
 *
 * It was written once, after every job in the sample had finished. An 80
 * job run takes minutes and costs real money, and a crash, a timeout or a
 * Ctrl+C at job 79 left nothing on disk: every answer already paid for was
 * gone, and the only copy of them was whatever the packets table happened
 * to keep. The file is now rewritten after each outcome, through a
 * temporary file and a rename, so the file on disk is always a complete
 * document and never a half written one, and a run that dies has every
 * answer it had finished.
 *
 * It also carried no provenance. It held the answers and nothing that says
 * what produced them: not the profile they were written against, not the
 * resume they were edits to, not the model, not the revision of the prompt
 * that asked for them nor of the validator that judged them, not even the
 * run tag. A measurement re-reading those answers a week later had to be
 * told all of it by hand, and D-029's reconstruction of the 18 September
 * runs failed precisely because no command line was on record. The header
 * now carries all of it, and reading it back can check the profile it was
 * written against is the profile in front of it.
 *
 * The previous format was a bare JSON array of outcomes. Reading handles
 * both: an array is a file from before this, and its header is unknown
 * rather than assumed.
 */

/** What produced a set of saved answers. Enough to reproduce the reading, not the run. */
export interface AnswersHeader {
  kind: "jobluvo-saved-answers";
  /** The run tag the packets were stored under. */
  run: string;
  /** When the run started, ISO 8601. */
  startedAt: string;
  /** The model the answers came from. */
  model: string;
  /** The revision of the prompt that asked for them. */
  promptRevision: string;
  /** The revision of the validator that judged them. */
  validatorRevision: string;
  /** The profile the answers were written against. */
  factsHash: string;
  /** The resume every change set is an edit to, and its hash, so a reader can check it rebuilt the same one. */
  baseResume: ResumeDocument;
  baseResumeHash: string;
  /** How many jobs the sample meant to do, so a short file is visibly short. */
  jobs: number;
}

export interface SavedAnswers {
  header: AnswersHeader | null;
  outcomes: SavedAnswer[];
}

/** One job's answers: every attempt's change set, and what the run made of them. */
export interface SavedAnswer {
  jobId: string;
  status: string;
  attempts: number;
  selected: number;
  usd: number;
  attemptLog: TailorOutcome["attemptLog"];
  changeSets: TailorOutcome["changeSets"];
  posting: string[];
}

export const savedAnswer = (o: TailorOutcome): SavedAnswer => ({
  jobId: o.jobId,
  status: o.status,
  attempts: o.attempts,
  selected: o.selected,
  usd: o.usd,
  attemptLog: o.attemptLog,
  changeSets: o.changeSets,
  posting: [...o.posting],
});

export const answersHeader = (h: Omit<AnswersHeader, "kind" | "baseResumeHash">): AnswersHeader => ({
  kind: "jobluvo-saved-answers",
  ...h,
  baseResumeHash: resumeHash(h.baseResume),
});

/**
 * Writes the file so far. Called after every outcome, so the cost of a
 * crash is one answer and not the whole run. The write goes to a temporary
 * file and is renamed over the target, which is atomic on one filesystem,
 * so a reader never sees a partial document and a crash mid write cannot
 * destroy the answers already saved.
 */
export function writeAnswers(path: string, header: AnswersHeader, outcomes: SavedAnswer[]): void {
  const tmp = `${path}.writing`;
  writeFileSync(tmp, JSON.stringify({ ...header, outcomes }));
  renameSync(tmp, path);
}

/**
 * Reads a saved answers file in either format.
 *
 * @param text the file's contents
 * @returns the outcomes, and the header when the file has one. A file from
 *   before headers existed reads as a null header: unknown, never guessed.
 */
export function readAnswers(text: string): SavedAnswers {
  const parsed: unknown = JSON.parse(text);
  if (Array.isArray(parsed)) return { header: null, outcomes: parsed as SavedAnswer[] };
  const o = parsed as AnswersHeader & { outcomes: SavedAnswer[] };
  if (o?.kind !== "jobluvo-saved-answers") throw new Error("not a saved answers file: no kind, and not the array the old format wrote");
  const { outcomes, ...header } = o;
  return { header, outcomes: outcomes ?? [] };
}
