import { z } from "zod";
import type { PacketFinding } from "@/db/schema";
import { CallError, structuredCall, type CallUsage, type PromptMessage, type ReasoningEffort } from "@/server/llm/client";
import { jobBlock, type ScoringJob } from "@/server/match/score";
import type { ChangeSet, FactEntry } from "./resume";

/*
 * The tailoring call. Two modes, one shipped:
 *
 *   "changes"   the model emits only edits: which line is replaced, by what
 *               text, citing the facts that support it, plus an optional
 *               top line and a skill order. The code assembles the
 *               document. Output is a few hundred tokens.
 *   "document"  the model emits every line of the resume. Exists so the
 *               sample can measure what the change set saves; output is
 *               the whole resume every time.
 *
 * The facts message is the stable one and goes first, as its own message,
 * for the cache (D-010). The validator, not this file, decides whether the
 * result may be shown (validate.ts).
 */

export type TailorMode = "changes" | "document";

export const MAX_CHANGES = 6;
export const MAX_OUTPUT_TOKENS: Record<TailorMode, number> = { changes: 900, document: 2500 };
/**
 * Per call, against a 60 s function: a packet is at most two attempts,
 * 2 x 20 s = 40 s, leaving 20 s for the facts, the validator and the packet
 * row. Measured over 228 calls on 17 Sep 2026, both modes: p50 4.5 s,
 * p99 10.6 s, max 17.1 s. So 20 s is 17 percent above the observed max:
 * thin, and the tail is provider latency. The unknown cost line in
 * `npm run cost-report` says whether the margin was wrong (D-015).
 */
export const TIMEOUT_MS = 20_000;
export const REASONING: ReasoningEffort = "none";
export const DEFAULT_MODEL = "gpt-5.6-luna";

/*
 * The truthfulness instruction, and it is now the main line of defence.
 *
 * The validator used to read a tailored line back and compare what it means
 * with what the cited fact means. That comparison is removed (D-034): the code
 * checks only that every value and every name appears somewhere in the
 * confirmed facts. What is left is stated here, and the four prohibitions are
 * the four cases of the principle at the top of design/docs/06-Decision-Log.md
 * in plain language, in order: case 2 a number moved, case 3 the level raised,
 * case 4 a meaning reversed, case 0 something added.
 *
 * Each prohibition carries one concrete example, which is the part a model
 * acts on, and it is the expensive part in tokens. The user's call, and the
 * cost is a few hundred input tokens on a call that already sends the facts
 * and the posting.
 */
const RULES = `What you may do: reword a line, restructure it, shorten it, change which fact it leads with, and use the posting's vocabulary where the candidate's fact already supports the word. Stronger, clearer wording of the same claim is the point of this task.

What you may not do, in any line or the summary:
- Move a number. Every number, amount, percentage and date stays attached to the same subject and the same measure it has in the fact. If the fact says churn fell 11 percent and acquisition cost fell 5 percent, you may not write that acquisition cost fell 11 percent.
- Raise the level. Keep the candidate's own role. Supported does not become led, trained does not become managed, contributed to does not become owned.
- Reverse a meaning. A denial stays a denial and a fall stays a fall. If the fact says the candidate did not manage recruitment, no line may say they managed it. If a figure is negative, it stays negative.
- Add anything. No metric, duty, tool, employer, product, qualification or skill that is not in the candidate's facts, however well it fits the posting.

If a posting asks for something the candidate's facts do not show, leave it out. A line you cannot write truthfully is a line you do not write.

Before you answer, read back every line you have written against the facts you cited for it, one line at a time, and confirm that each claim in the line is supported by those facts. Check the number against its subject, the level of responsibility, the direction of any change, and every name. If a line is not supported, rewrite it so that it is, or drop it. Do this before you return your answer, not as commentary in it.

Keep each line under 30 words. Plain language, no exclamation marks, no em dashes, write "resume" not "résumé".`;

export const INSTRUCTIONS: Record<TailorMode, string> = {
  changes: `You tailor a candidate's resume to one job posting by editing a small number of lines. You are given the candidate's confirmed facts, each with an id, and the posting.

Return at most ${MAX_CHANGES} changes. Each change names one existing bullet id (such as R1.2), gives the replacement text, and lists the ids of the facts that support the new text (the bullet itself and any other fact you drew on). List the ids of the facts the new text draws on, so a person reading the packet can see where each line came from. Only rewrite a line when the posting gives a reason: to lead with what the posting asks for, to use its vocabulary where the fact allows it, or to shorten. Leave every other line alone. Optionally give a one sentence summary for the top of the resume, built only from the facts, or null, and in "summary_facts" the ids of the facts it draws on. Optionally list skill ids to show first, in order, or an empty list.

${RULES}`,
  document: `You tailor a candidate's resume to one job posting. You are given the candidate's confirmed facts, each with an id, and the posting.

Return the whole resume: for every role id (R1, R2, ...) return its bullets in order, rewritten where the posting gives a reason and otherwise as they are; a one sentence summary for the top, built only from the facts, or null; and the skill names in the order to show them. Keep every role and the same number of bullets per role.

${RULES}`,
};

export const CHANGES_SCHEMA = {
  type: "object",
  properties: {
    summary: { type: ["string", "null"] },
    summary_facts: { type: "array", items: { type: "string" } },
    changes: {
      type: "array",
      items: {
        type: "object",
        properties: {
          bullet: { type: "string" },
          text: { type: "string" },
          facts: { type: "array", items: { type: "string" } },
        },
        required: ["bullet", "text", "facts"],
        additionalProperties: false,
      },
    },
    skills: { type: "array", items: { type: "string" } },
  },
  required: ["summary", "summary_facts", "changes", "skills"],
  additionalProperties: false,
} as const;

export const DOCUMENT_SCHEMA = {
  type: "object",
  properties: {
    summary: { type: ["string", "null"] },
    experience: {
      type: "array",
      items: {
        type: "object",
        properties: { id: { type: "string" }, bullets: { type: "array", items: { type: "string" } } },
        required: ["id", "bullets"],
        additionalProperties: false,
      },
    },
    skills: { type: "array", items: { type: "string" } },
  },
  required: ["summary", "experience", "skills"],
  additionalProperties: false,
} as const;

const changesOutput = z.object({
  summary: z.string().nullable(),
  summary_facts: z.array(z.string()),
  changes: z.array(z.object({ bullet: z.string(), text: z.string(), facts: z.array(z.string()) })),
  skills: z.array(z.string()),
});

const documentOutput = z.object({
  summary: z.string().nullable(),
  experience: z.array(z.object({ id: z.string(), bullets: z.array(z.string()) })),
  skills: z.array(z.string()),
});

export type DocumentOutput = z.infer<typeof documentOutput>;

const tidy = (s: string) => s.trim().replace(/[!—]/g, "").replace(/\s+/g, " ");

export function parseChanges(text: string): ChangeSet {
  const r = changesOutput.safeParse(JSON.parse(text));
  if (!r.success) throw new Error(`model output does not match the change set schema: ${r.error.issues.map((i) => i.path.join(".")).join(", ")}`);
  return {
    summary: r.data.summary ? tidy(r.data.summary) : null,
    summaryFacts: r.data.summary_facts.map((f) => f.trim()),
    changes: r.data.changes.slice(0, MAX_CHANGES).map((c) => ({ bullet: c.bullet.trim(), text: tidy(c.text), facts: c.facts.map((f) => f.trim()) })),
    skills: r.data.skills.map((s) => s.trim()),
  };
}

export function parseDocument(text: string): DocumentOutput {
  const r = documentOutput.safeParse(JSON.parse(text));
  if (!r.success) throw new Error(`model output does not match the document schema: ${r.error.issues.map((i) => i.path.join(".")).join(", ")}`);
  return {
    summary: r.data.summary ? tidy(r.data.summary) : null,
    experience: r.data.experience.map((e) => ({ id: e.id.trim(), bullets: e.bullets.map(tidy) })),
    skills: r.data.skills.map((s) => s.trim()),
  };
}

/** The stable message: every confirmed fact with its id. */
/**
 * The revision of the prompt: the messages, the schemas and the retry
 * instruction together. Bumped with every change to any of them, and
 * written into a sample's saved answers so a measurement says which prompt
 * produced the answers it is reading (review four, finding 18). p2 is the
 * retry being shown the answer it is correcting (finding 14). p5 aligns the
 * retry with the standing rule it contradicted and says what returning or
 * omitting a line means, since the code reads the two differently (D-039).
 * p5 changes the retry path only, so it is paid on a retry and never on a
 * first call.
 */
export const PROMPT_REVISION = "2026-09-19.p5";

export function factsBlock(entries: FactEntry[]): string {
  return ["CANDIDATE FACTS, each with its id", "", ...entries.map((e) => `${e.id}: ${e.text}`)].join("\n");
}

/**
 * The answer the retry is correcting, printed so the model edits it rather
 * than writing a new one from the posting.
 *
 * The closing instruction says what returning a line means and what leaving one
 * out means, because the code now treats those differently and the model should
 * not have to guess which it is doing (D-039). It also stops telling the model
 * that an unflagged line must come back unchanged, which contradicted the
 * standing rule that an unsupported line is rewritten or dropped.
 */
function previousBlock(cs: ChangeSet): string {
  const lines = [
    ...(cs.summary ? [`- summary: ${cs.summary}`] : []),
    ...cs.changes.map((c) => `- ${c.bullet}: ${c.text}${c.facts.length ? ` [facts: ${c.facts.join(", ")}]` : ""}`),
  ];
  return `\n\nYOUR PREVIOUS ANSWER, the lines you returned last time:\n${lines.length ? lines.join("\n") : "- no lines"}\nReturn all of these lines again, changing the ones named below. Leave the rest as they are, with one exception: if reading a line back against the facts it cites shows those facts do not support it, correct that line or write the resume's original line back in its place. Every line you return is your decision and it stands, including a line you return at the resume's original text. A line you leave out is read as an accident and the version above is put back, so a line you mean to change must be returned changed. The summary is always your decision: return it again to keep it.`;
}

export function buildMessages(facts: string, job: string, retryOf?: PacketFinding[], previousAnswer?: ChangeSet): PromptMessage[] {
  const posting = retryOf?.length
    ? `${job}${previousAnswer ? previousBlock(previousAnswer) : ""}\n\nYour previous answer did not pass the validator. Fix these and answer again. Where a finding names a word, replace that word with the cited fact's own word; where it names a value, use the cited fact's value and its meaning; where it says no fact is cited, cite the fact the line draws on. Do not drop a line, a number or a claim merely to pass the check. Correcting a line the facts do not support, or writing the resume's original line back in its place, is not dropping it: that is the task, and it applies to every line, not only the ones named here.\n${retryOf.map((f) => `- ${f.bullet ?? "summary"}: ${f.message}${f.value ? ` (${f.value})` : ""}${f.detail ? `; ${f.detail}` : ""}`).join("\n")}`
    : job;
  return [
    { role: "developer", content: facts },
    { role: "user", content: posting },
  ];
}

export interface TailorResult {
  text: string;
  model: string;
  usage: CallUsage;
  usd: number;
  ms: number;
}

export class TailorError extends Error {
  constructor(
    message: string,
    public model: string,
    public usage: CallUsage | null,
    public usd: number,
    public ms: number,
  ) {
    super(message);
  }
}

/** One call. Parsing and validation are the caller's, so a paid call that fails to parse still reports its usage. */
export async function tailorCall(
  entries: FactEntry[],
  job: ScoringJob,
  opts: { mode: TailorMode; model?: string; retryOf?: PacketFinding[]; previousAnswer?: ChangeSet },
): Promise<TailorResult> {
  const model = opts.model ?? DEFAULT_MODEL;
  const started = Date.now();
  try {
    const call = await structuredCall({
      model,
      instructions: INSTRUCTIONS[opts.mode],
      input: buildMessages(factsBlock(entries), jobBlock(job), opts.retryOf, opts.previousAnswer),
      schemaName: opts.mode === "changes" ? "resume_changes" : "resume_document",
      schema: opts.mode === "changes" ? CHANGES_SCHEMA : DOCUMENT_SCHEMA,
      maxOutputTokens: MAX_OUTPUT_TOKENS[opts.mode],
      reasoning: REASONING,
      timeoutMs: TIMEOUT_MS,
    });
    return { text: call.text, model, usage: call.usage, usd: call.usd, ms: call.ms };
  } catch (e) {
    if (e instanceof CallError) throw new TailorError(e.message, model, e.usage, e.usd, e.ms);
    throw new TailorError(e instanceof Error ? e.message : String(e), model, null, 0, Date.now() - started);
  }
}
