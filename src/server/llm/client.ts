import OpenAI from "openai";
import { env } from "@/lib/env";
import { costUsd, priceFor, type Usage } from "./prices";

/*
 * The one place a model is called. Every call goes through `structuredCall`,
 * which asks for a strict JSON schema, refuses an unpriced model before the
 * request is sent, and returns the usage the caller must write to
 * cost_events. Nothing here retries: the caller owns attempts, because a
 * retry is a paid call and the matches row is what counts them.
 */

let client: OpenAI | null = null;

function openai(): OpenAI {
  if (client) return client;
  const key = env().OPENAI_API_KEY;
  if (!key) throw new Error("OPENAI_API_KEY is not set");
  client = new OpenAI({ apiKey: key });
  return client;
}

export type ReasoningEffort = "none" | "low" | "medium";

/** A part of a message: text, or a file the API renders for the model. */
export type PromptContent =
  | { type: "input_text"; text: string }
  | { type: "input_file"; filename: string; file_data: string };

export interface PromptMessage {
  role: "developer" | "user";
  content: string | PromptContent[];
}

export interface StructuredCall {
  model: string;
  /** The system text. Sent as `instructions`, which the API places before the input, so it is part of the cacheable prefix. */
  instructions: string;
  /**
   * The messages after the instructions. The cache on this model hits at
   * message boundaries, not on a token prefix: a message that repeats
   * verbatim is served from cache, a message that differs by one word at
   * its end is not. So the stable part must be its own message, and it
   * must come first.
   */
  input: PromptMessage[];
  schemaName: string;
  schema: Record<string, unknown>;
  maxOutputTokens: number;
  reasoning: ReasoningEffort;
}

export interface CallUsage extends Usage {
  cachedInputTokens: number;
  /** Included in outputTokens; broken out so a runaway reasoning budget is visible. */
  reasoningTokens: number;
}

export interface CallResult {
  text: string;
  usage: CallUsage;
  usd: number;
  ms: number;
}

export async function structuredCall(c: StructuredCall): Promise<CallResult> {
  priceFor(c.model);
  const started = Date.now();
  const res = await openai().responses.create({
    model: c.model,
    instructions: c.instructions,
    input: c.input,
    text: { format: { type: "json_schema", name: c.schemaName, schema: c.schema, strict: true } },
    max_output_tokens: c.maxOutputTokens,
    reasoning: { effort: c.reasoning },
    store: false,
  });
  const ms = Date.now() - started;
  const u = res.usage;
  const usage: CallUsage = {
    inputTokens: u?.input_tokens ?? 0,
    cachedInputTokens: u?.input_tokens_details?.cached_tokens ?? 0,
    outputTokens: u?.output_tokens ?? 0,
    reasoningTokens: u?.output_tokens_details?.reasoning_tokens ?? 0,
  };
  const usd = costUsd(c.model, usage);
  if (res.status === "incomplete") {
    const why = res.incomplete_details?.reason ?? "unknown";
    throw new CallError(`response incomplete: ${why}`, usage, usd, ms);
  }
  return { text: res.output_text, usage, usd, ms };
}

/** A call that cost money and still failed. Carries the usage so the cost row is written anyway. */
export class CallError extends Error {
  constructor(
    message: string,
    public usage: CallUsage,
    public usd: number,
    public ms: number,
  ) {
    super(message);
  }
}
