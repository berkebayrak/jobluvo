import { z } from "zod";
import type { JobLocation } from "@/db/schema";
import { CallError, structuredCall, type CallUsage, type PromptMessage, type ReasoningEffort } from "@/server/llm/client";

/*
 * One scoring call: the candidate profile and one posting in, a score and a
 * few short lines out. JOB-06: the score is fit against the stated
 * requirements, not a hiring probability, and every line points at a fact
 * on the profile or a sentence in the posting. Nothing is invented.
 *
 * Designed for cost. Output is a strict schema of one integer and at most
 * seven short strings, because output tokens were 74 percent of the naive
 * bill (D-002). Input is two messages, the profile first as its own message
 * and the job after it, because the cache on this model hits whole messages
 * that repeat, not token prefixes (D-010): the profile message is served
 * from cache for every job after the first. `PromptOrder` exists so the
 * sample can measure the other order too and show what the choice is worth.
 */

export const JOB_TEXT_CHARS = 8000;
export const MAX_OUTPUT_TOKENS = 400;
/**
 * Per call, against the cron's 60 s function: SCORE_BATCH 20 at
 * SCORE_CONCURRENCY 5 is four waves, 4 x 12 s = 48 s, leaving 12 s for the
 * claim and the writes. Measured over 400 calls on 17 Sep 2026: p50 2.5 s,
 * p99 7.6 s, max 10.5 s. So 12 s is 14 percent above the observed max: thin,
 * and the tail is provider latency. The unknown cost line in
 * `npm run cost-report` says whether the margin was wrong (D-015).
 */
export const TIMEOUT_MS = 12_000;
/** No reasoning budget: the output is one integer and seven short lines, and reasoning tokens bill as output. */
export const REASONING: ReasoningEffort = "none";
export const DEFAULT_MODEL = "gpt-5.6-luna";

export type PromptOrder = "profile-first" | "job-first";

export const INSTRUCTIONS = `You score how well one candidate fits one job posting. You are given the candidate's profile and the posting.

Score 0 to 100 for fit against what the posting states: role family, level, years, must have skills and stated responsibilities. 85 to 100: the profile meets the stated requirements at the stated level. 60 to 84: most requirements met, one gap or a level mismatch. 35 to 59: some overlap, the role family or level is off. 0 to 34: a different field. The score is fit, not the chance of being hired.

Write "for": up to 3 lines, "against": up to 2 lines, "unknowns": up to 2 lines. Each line at most 10 words, plain language, one fact each, no trailing full stop. A "for" or "against" line must name something on the profile or in the posting. An "unknowns" line names something the posting or the profile does not say that would change the score. Never assume a fact that is not stated. Do not mention visa, sponsorship, citizenship or work authorization; they are handled elsewhere. Do not use exclamation marks or em dashes. Write "resume", not "résumé".`;

export const SCORE_SCHEMA = {
  type: "object",
  properties: {
    score: { type: "integer", minimum: 0, maximum: 100 },
    for: { type: "array", items: { type: "string" } },
    against: { type: "array", items: { type: "string" } },
    unknowns: { type: "array", items: { type: "string" } },
  },
  required: ["score", "for", "against", "unknowns"],
  additionalProperties: false,
} as const;

const scoreOutput = z.object({
  score: z.number().int().min(0).max(100),
  for: z.array(z.string()),
  against: z.array(z.string()),
  unknowns: z.array(z.string()),
});

export interface ScoringJob {
  id: string;
  title: string;
  companyName: string;
  locations: JobLocation[];
  workplace: string;
  employmentType: string | null;
  seniority: string | null;
  compRaw: string | null;
  compMin: number | null;
  compMax: number | null;
  compCurrency: string | null;
  compPeriod: string;
  descriptionCore: string;
  /** The revision of the posting these fields were read from, loaded in the same read, so a packet is stamped with the text the model saw (review four, finding 15). */
  contentHash: string;
}

export function jobBlock(j: ScoringJob): string {
  const lines = ["JOB POSTING", `Title: ${j.title}`, `Company: ${j.companyName}`];
  const locs = j.locations.map((l) => l.raw).filter(Boolean);
  if (locs.length) lines.push(`Location: ${locs.join("; ")}`);
  if (j.workplace !== "unknown") lines.push(`Workplace: ${j.workplace}`);
  if (j.employmentType) lines.push(`Employment type: ${j.employmentType}`);
  if (j.seniority) lines.push(`Level: ${j.seniority}`);
  if (j.compRaw) lines.push(`Compensation: ${j.compRaw}`);
  else if (j.compMin != null || j.compMax != null) {
    const range = [j.compMin, j.compMax].filter((n) => n != null).join(" to ");
    lines.push(`Compensation: ${j.compCurrency ?? ""} ${range} per ${j.compPeriod === "unknown" ? "period not stated" : j.compPeriod}`.trim());
  }
  const text = j.descriptionCore.length > JOB_TEXT_CHARS ? `${j.descriptionCore.slice(0, JOB_TEXT_CHARS)}\n[truncated]` : j.descriptionCore;
  lines.push("", text);
  return lines.join("\n");
}

/** The messages after the instructions. Profile first is the shipped order; job first exists only so the sample can measure the difference. */
export function buildInput(profileBlock: string, job: string, order: PromptOrder): PromptMessage[] {
  const profile: PromptMessage = { role: "developer", content: profileBlock };
  const posting: PromptMessage = { role: "user", content: job };
  return order === "profile-first" ? [profile, posting] : [posting, profile];
}

export type Band = "strong" | "good" | "weak";

export function bandOf(score: number): Band {
  return score >= 75 ? "strong" : score >= 55 ? "good" : "weak";
}

export interface ParsedScore {
  score: number;
  band: Band;
  /** For lines plain, against lines prefixed "- ", as the cards read them. */
  reasons: string[];
  unknowns: string[];
}

export const LINE_CHARS = 90;

/** Trims, drops exclamation marks and em dashes, and cuts a long line at a word boundary. */
const clean = (xs: string[], n: number) =>
  xs
    .map((s) => s.trim().replace(/[!—]/g, "").replace(/\s+/g, " ").replace(/\.$/, ""))
    .filter(Boolean)
    .map((s) => {
      if (s.length <= LINE_CHARS) return s;
      const cut = s.lastIndexOf(" ", LINE_CHARS - 1);
      return s.slice(0, cut > 40 ? cut : LINE_CHARS).replace(/[,;:]$/, "");
    })
    .slice(0, n);

export function parseScore(text: string): ParsedScore {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new Error("model output is not JSON");
  }
  const r = scoreOutput.safeParse(raw);
  if (!r.success) throw new Error(`model output does not match the schema: ${r.error.issues.map((i) => i.path.join(".")).join(", ")}`);
  const score = Math.round(r.data.score);
  return {
    score,
    band: bandOf(score),
    reasons: [...clean(r.data.for, 3), ...clean(r.data.against, 2).map((s) => `- ${s}`)],
    unknowns: clean(r.data.unknowns, 2),
  };
}

export interface ScoreResult extends ParsedScore {
  model: string;
  usage: CallUsage;
  usd: number;
  ms: number;
}

/** Thrown when the call was made and paid for but produced nothing usable. */
export class ScoreError extends Error {
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

export async function scoreJob(
  profileBlock: string,
  job: ScoringJob,
  opts: { model?: string; order?: PromptOrder; reasoning?: ReasoningEffort } = {},
): Promise<ScoreResult> {
  const model = opts.model ?? DEFAULT_MODEL;
  const started = Date.now();
  let call;
  try {
    call = await structuredCall({
      model,
      instructions: INSTRUCTIONS,
      input: buildInput(profileBlock, jobBlock(job), opts.order ?? "profile-first"),
      schemaName: "match_score",
      schema: SCORE_SCHEMA,
      maxOutputTokens: MAX_OUTPUT_TOKENS,
      reasoning: opts.reasoning ?? REASONING,
      timeoutMs: TIMEOUT_MS,
    });
  } catch (e) {
    if (e instanceof CallError) throw new ScoreError(e.message, model, e.usage, e.usd, e.ms);
    throw new ScoreError(e instanceof Error ? e.message : String(e), model, null, 0, Date.now() - started);
  }
  try {
    return { ...parseScore(call.text), model, usage: call.usage, usd: call.usd, ms: call.ms };
  } catch (e) {
    throw new ScoreError(e instanceof Error ? e.message : String(e), model, call.usage, call.usd, call.ms);
  }
}
