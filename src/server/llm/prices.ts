/**
 * USD per million tokens, by model id. The cost meter refuses to run for a
 * model id that is not listed, so switching MODEL_TAILOR to something unpriced
 * fails loudly instead of logging USD 0 and corrupting the one number Phase 0
 * exists to produce.
 *
 * Rates from the OpenAI pricing page, standard tier, as of 17 September
 * 2026. Verify the API string with GET /v1/models/{id} before relying on a
 * new entry. cacheWrite is not on the page and the meter does not use it.
 *
 * Gotcha the meter encodes: a request whose input exceeds LONG_CONTEXT_TOKENS
 * bills at 2x input and 1.5x output. Nothing in Phase 0 should come near
 * 272,000 input tokens, so if a cost row ever lands far outside its band, a
 * prompt blowing past this threshold is the first thing to check.
 */
export interface ModelPrice {
  input: number;
  cachedInput: number;
  cacheWrite: number;
  output: number;
  contextWindow: number;
  maxOutput: number;
}

export const LONG_CONTEXT_TOKENS = 272_000;
export const LONG_CONTEXT_INPUT_MULTIPLIER = 2;
export const LONG_CONTEXT_OUTPUT_MULTIPLIER = 1.5;

export const PRICES: Record<string, ModelPrice> = {
  "gpt-5.6-luna": {
    input: 0.2,
    cachedInput: 0.02,
    cacheWrite: 0.25,
    output: 1.2,
    contextWindow: 1_050_000,
    maxOutput: 128_000,
  },
  // The MODEL_TAILOR candidates (D-001). sol is 20 times luna, terra 10 times.
  "gpt-5.6-sol": {
    input: 4,
    cachedInput: 0.4,
    cacheWrite: 4,
    output: 20,
    contextWindow: 1_050_000,
    maxOutput: 128_000,
  },
  "gpt-5.6-terra": {
    input: 2,
    cachedInput: 0.2,
    cacheWrite: 2,
    output: 12,
    contextWindow: 1_050_000,
    maxOutput: 128_000,
  },
};

export interface Usage {
  inputTokens: number;
  cachedInputTokens?: number;
  outputTokens: number;
}

export function priceFor(model: string): ModelPrice {
  const p = PRICES[model];
  if (!p) throw new Error(`No price entry for model "${model}". Add it to src/server/llm/prices.ts before use.`);
  return p;
}

/** Cost of one call in USD, with the long context multipliers applied when they bite. */
export function costUsd(model: string, usage: Usage): number {
  const p = priceFor(model);
  const cached = usage.cachedInputTokens ?? 0;
  const fresh = Math.max(0, usage.inputTokens - cached);
  const long = usage.inputTokens > LONG_CONTEXT_TOKENS;
  const inMul = long ? LONG_CONTEXT_INPUT_MULTIPLIER : 1;
  const outMul = long ? LONG_CONTEXT_OUTPUT_MULTIPLIER : 1;
  const usd =
    (fresh * p.input * inMul + cached * p.cachedInput * inMul + usage.outputTokens * p.output * outMul) /
    1_000_000;
  return Number(usd.toFixed(8));
}
