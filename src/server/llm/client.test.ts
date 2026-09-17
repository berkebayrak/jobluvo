import { APIConnectionError, APIConnectionTimeoutError } from "openai";
import { afterEach, describe, expect, it, vi } from "vitest";

/*
 * The client's limits, with the SDK stubbed: the SDK is built with no
 * retries and the call ceiling, every request carries its own timeout and
 * no retries, a timeout or a lost connection is reported as a call of
 * unknown cost with no usage, and a budget above the ceiling is refused
 * before any request is sent. No database, no network.
 */

const created: { options: Record<string, unknown> }[] = [];
const create = vi.fn();

vi.mock("openai", async (importOriginal) => {
  const real = await importOriginal<typeof import("openai")>();
  class FakeOpenAI {
    responses = { create };
    constructor(options: Record<string, unknown>) {
      created.push({ options });
    }
  }
  return { ...real, default: FakeOpenAI };
});

vi.mock("@/lib/env", () => ({ env: () => ({ OPENAI_API_KEY: "test-key" }) }));

const { CallError, CallUnknownError, FUNCTION_BUDGET_MS, MAX_CALL_TIMEOUT_MS, MAX_RETRIES, structuredCall } = await import("./client");

const call = (timeoutMs: number) => ({
  model: "gpt-5.6-luna",
  instructions: "Answer.",
  input: [{ role: "user" as const, content: "hello" }],
  schemaName: "t",
  schema: { type: "object", properties: {}, additionalProperties: false },
  maxOutputTokens: 50,
  reasoning: "none" as const,
  timeoutMs,
});

const response = {
  status: "completed",
  output_text: "{}",
  usage: { input_tokens: 100, input_tokens_details: { cached_tokens: 40 }, output_tokens: 10, output_tokens_details: { reasoning_tokens: 0 } },
};

afterEach(() => create.mockReset());

describe("the client's retries and timeouts", () => {
  it("builds the SDK with no retries and the call ceiling, and sends each request with its own timeout and no retries", async () => {
    create.mockResolvedValueOnce(response);
    const out = await structuredCall(call(12_000));
    expect(MAX_RETRIES).toBe(0);
    expect(MAX_CALL_TIMEOUT_MS).toBeLessThan(FUNCTION_BUDGET_MS);
    expect(created).toHaveLength(1);
    expect(created[0].options).toMatchObject({ apiKey: "test-key", maxRetries: 0, timeout: MAX_CALL_TIMEOUT_MS });
    expect(create).toHaveBeenCalledTimes(1);
    expect(create.mock.calls[0][1]).toEqual({ timeout: 12_000, maxRetries: 0 });
    expect(out.usage).toEqual({ inputTokens: 100, cachedInputTokens: 40, outputTokens: 10, reasoningTokens: 0 });
  });

  it("reports a timeout as a call of unknown cost, with no usage and no second request", async () => {
    create.mockRejectedValueOnce(new APIConnectionTimeoutError());
    const err = await structuredCall(call(12_000)).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(CallUnknownError);
    expect(err).not.toBeInstanceOf(CallError);
    expect((err as Error).message).toContain("timed out after 12000ms");
    expect((err as Error).message).toContain("cost unknown");
    expect(create).toHaveBeenCalledTimes(1);
  });

  it("reports a lost connection the same way", async () => {
    create.mockRejectedValueOnce(new APIConnectionError({ message: "socket hang up" }));
    const err = await structuredCall(call(12_000)).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(CallUnknownError);
    expect((err as Error).message).toContain("cost unknown");
    expect((err as Error).message).toContain("socket hang up");
    expect(create).toHaveBeenCalledTimes(1);
  });

  it("leaves an incomplete response as a paid call with its usage", async () => {
    create.mockResolvedValueOnce({ ...response, status: "incomplete", incomplete_details: { reason: "max_output_tokens" } });
    const err = await structuredCall(call(12_000)).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(CallError);
    expect((err as InstanceType<typeof CallError>).usage.outputTokens).toBe(10);
  });

  it("refuses a budget above the ceiling or not positive before any request is sent", async () => {
    await expect(structuredCall(call(MAX_CALL_TIMEOUT_MS + 1))).rejects.toThrow(/outside 1\.\.40000ms/);
    await expect(structuredCall(call(0))).rejects.toThrow(/outside/);
    expect(create).not.toHaveBeenCalled();
  });
});
