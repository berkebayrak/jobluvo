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
export const REASONING: ReasoningEffort = "none";
export const DEFAULT_MODEL = "gpt-5.6-luna";

const RULES = `Every number, amount, percentage, date, employer, product and qualification in what you write must come from the candidate's facts, word for word or as a plain restatement. Never add a metric, duty, tool or skill that is not there. You may reorder, shorten, reword and choose which facts to lead with. Keep each line under 30 words. Plain language, no exclamation marks, no em dashes, write "resume" not "résumé".`;

export const INSTRUCTIONS: Record<TailorMode, string> = {
  changes: `You tailor a candidate's resume to one job posting by editing a small number of lines. You are given the candidate's confirmed facts, each with an id, and the posting.

Return at most ${MAX_CHANGES} changes. Each change names one existing bullet id (such as R1.2), gives the replacement text, and lists the ids of the facts that support the new text (the bullet itself and any other fact you drew on). Only rewrite a line when the posting gives a reason: to lead with what the posting asks for, to use its vocabulary where the fact allows it, or to shorten. Leave every other line alone. Optionally give a one sentence summary for the top of the resume, built only from the facts, or null. Optionally list skill ids to show first, in order, or an empty list.

${RULES}`,
  document: `You tailor a candidate's resume to one job posting. You are given the candidate's confirmed facts, each with an id, and the posting.

Return the whole resume: for every role id (R1, R2, ...) return its bullets in order, rewritten where the posting gives a reason and otherwise as they are; a one sentence summary for the top, built only from the facts, or null; and the skill names in the order to show them. Keep every role and the same number of bullets per role.

${RULES}`,
};

export const CHANGES_SCHEMA = {
  type: "object",
  properties: {
    summary: { type: ["string", "null"] },
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
  required: ["summary", "changes", "skills"],
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
export function factsBlock(entries: FactEntry[]): string {
  return ["CANDIDATE FACTS, each with its id", "", ...entries.map((e) => `${e.id}: ${e.text}`)].join("\n");
}

export function buildMessages(facts: string, job: string, retryOf?: PacketFinding[]): PromptMessage[] {
  const posting = retryOf?.length
    ? `${job}\n\nYour previous answer was rejected by the validator. Fix these and answer again:\n${retryOf.map((f) => `- ${f.bullet ?? "summary"}: ${f.message}${f.value ? ` (${f.value})` : ""}`).join("\n")}`
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
  opts: { mode: TailorMode; model?: string; retryOf?: PacketFinding[] },
): Promise<TailorResult> {
  const model = opts.model ?? DEFAULT_MODEL;
  const started = Date.now();
  try {
    const call = await structuredCall({
      model,
      instructions: INSTRUCTIONS[opts.mode],
      input: buildMessages(factsBlock(entries), jobBlock(job), opts.retryOf),
      schemaName: opts.mode === "changes" ? "resume_changes" : "resume_document",
      schema: opts.mode === "changes" ? CHANGES_SCHEMA : DOCUMENT_SCHEMA,
      maxOutputTokens: MAX_OUTPUT_TOKENS[opts.mode],
      reasoning: REASONING,
    });
    return { text: call.text, model, usage: call.usage, usd: call.usd, ms: call.ms };
  } catch (e) {
    if (e instanceof CallError) throw new TailorError(e.message, model, e.usage, e.usd, e.ms);
    throw new TailorError(e instanceof Error ? e.message : String(e), model, null, 0, Date.now() - started);
  }
}
