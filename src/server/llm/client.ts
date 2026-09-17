import OpenAI, { APIConnectionError, APIConnectionTimeoutError } from "openai";
import { env } from "@/lib/env";
import { costUsd, priceFor, type Usage } from "./prices";

/*
 * The one place a model is called. Every call goes through `structuredCall`,
 * which asks for a strict JSON schema, refuses an unpriced model before the
 * request is sent, and returns the usage the caller must write to
 * cost_events.
 *
 * The SDK is told not to retry. Its default is two retries on a timeout, a
 * connection error, 408, 409, 429 or any 5xx, underneath the caller's own
 * attempt: a generation the provider completed and billed before the
 * response was lost would be paid for again by the retry, with one cost row
 * for the two. The caller owns attempts, because an attempt is a paid call
 * and the matches or packets row is what counts them.
 *
 * Every call carries a timeout chosen against the function it runs in.
 * The routes that call a model declare maxDuration 60, the Vercel Hobby
 * ceiling, so the SDK's ten minute default would never fire: the function
 * would be killed first, with no error and no usage. Each call site states
 * its own budget from that ceiling (score.ts, tailor.ts, extract.ts), and
 * the client refuses one above MAX_CALL_TIMEOUT_MS. A call that times out
 * has an unknown cost: the provider may have finished and billed it. The
 * error says so and no cost row is written, since there is no usage.
 */

/** The function ceiling every model call runs under: `maxDuration = 60` on the cron and upload routes, Vercel Hobby. */
export const FUNCTION_BUDGET_MS = 60_000;
/** The largest single call budget: extraction, one call per upload, leaving 20 s of the 60 for the file and the writes. */
export const MAX_CALL_TIMEOUT_MS = 40_000;
/** The caller owns attempts; a hidden retry is unmetered spend. */
export const MAX_RETRIES = 0;

let client: OpenAI | null = null;

function openai(): OpenAI {
  if (client) return client;
  const key = env().OPENAI_API_KEY;
  if (!key) throw new Error("OPENAI_API_KEY is not set");
  client = new OpenAI({ apiKey: key, maxRetries: MAX_RETRIES, timeout: MAX_CALL_TIMEOUT_MS });
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
  /** The call's own budget, stated by the call site against the function it runs in. At most MAX_CALL_TIMEOUT_MS. */
  timeoutMs: number;
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
  if (!(c.timeoutMs > 0) || c.timeoutMs > MAX_CALL_TIMEOUT_MS) {
    throw new Error(`call timeout ${c.timeoutMs}ms is outside 1..${MAX_CALL_TIMEOUT_MS}ms, the largest budget under the ${FUNCTION_BUDGET_MS}ms function ceiling`);
  }
  const started = Date.now();
  let res: OpenAI.Responses.Response;
  try {
    res = await openai().responses.create(
      {
        model: c.model,
        instructions: c.instructions,
        input: c.input,
        text: { format: { type: "json_schema", name: c.schemaName, schema: c.schema, strict: true } },
        max_output_tokens: c.maxOutputTokens,
        reasoning: { effort: c.reasoning },
        store: false,
      },
      { timeout: c.timeoutMs, maxRetries: MAX_RETRIES },
    );
  } catch (e) {
    if (e instanceof APIConnectionTimeoutError) throw new CallUnknownError(`call timed out after ${c.timeoutMs}ms, cost unknown: the provider may have completed and billed it`, Date.now() - started);
    if (e instanceof APIConnectionError) throw new CallUnknownError(`connection failed, cost unknown: ${e.message}`, Date.now() - started);
    throw e;
  }
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

/**
 * A call whose cost is unknown: it timed out or the connection failed, so
 * no usage came back, and the provider may or may not have completed and
 * billed the generation. There is nothing to write to cost_events; the
 * message travels into the row's error text so the report can count them.
 */
export class CallUnknownError extends Error {
  constructor(
    message: string,
    public ms: number,
  ) {
    super(message);
  }
}
