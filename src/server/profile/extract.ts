import { z } from "zod";
import { eq } from "drizzle-orm";
import type { DbPool, Tx } from "@/db/client";
import { profileDocuments, profileFacts } from "@/db/schema";
import { recordCost } from "@/server/cost";
import { env } from "@/lib/env";
import { CallError, structuredCall, type CallUsage, type PromptContent, type ReasoningEffort } from "@/server/llm/client";
import { answerFact, educationFact, employmentFact, skillFact } from "./facts";

/*
 * Resume extraction (ID-02, ID-03): one call per resume, the file itself as
 * the input, a strict JSON of the facts the schemas accept, each with the
 * span of the resume it came from. Every fact lands as `extracted`, origin
 * `upload`, and nothing downstream reads it until the user confirms it.
 *
 * The PDF goes to the model as a file, which the API renders page by page.
 * A text parser would send fewer input tokens; it is a dependency the code
 * base does not have, and the sample measures both inputs so the choice is
 * a number rather than a guess (D-014).
 */

export const DEFAULT_MODEL = "gpt-5.6-luna";
export const REASONING: ReasoningEffort = "none";
export const MAX_OUTPUT_TOKENS = 4000;
/**
 * Per call, against the upload route's 60 s function: one call per upload,
 * 40 s, leaving 20 s for the file and the writes. This is the largest
 * budget the client allows. Measured over 17 calls on 17 Sep 2026 at about
 * 1,500 output tokens: p50 10.6 s, p99 18.5 s, max 18.7 s, 8.6 ms per
 * output token, so the 4,000 token cap fits in 34 s. 40 s is 114 percent
 * above the observed max, but only 18 percent above the token cap's time;
 * a real two page resume spends that margin. A failed call leaves its
 * message on the document row, so an unknown cost call is counted by
 * `npm run cost-report` like a scoring or tailoring one (D-015).
 */
export const TIMEOUT_MS = 40_000;

export const INSTRUCTIONS = `You read one resume and return its facts as structured data. Copy what the resume says; never infer, summarise or improve it. Every number, date, employer and title must appear in the resume. Dates as YYYY-MM; a role with no end date is current, leave "end" null. Put each bullet of a role in "bullets" as written, one entry per bullet. Skills as the resume lists them, with years only when the resume states them, and the phrase the resume uses as "evidence". "answers" are stated standing answers such as a salary expectation or a notice period; leave the list empty when there are none. For every item give "evidence": the exact words of the resume it came from, at most 20 words. Flag anything ambiguous or unreadable in "issues", one short line each. No exclamation marks, no em dashes.`;

export const EXTRACT_SCHEMA = {
  type: "object",
  properties: {
    name: { type: ["string", "null"] },
    email: { type: ["string", "null"] },
    location: { type: ["string", "null"] },
    links: { type: "array", items: { type: "string" } },
    employment: {
      type: "array",
      items: {
        type: "object",
        properties: {
          company: { type: "string" },
          title: { type: "string" },
          location: { type: ["string", "null"] },
          start: { type: "string" },
          end: { type: ["string", "null"] },
          bullets: { type: "array", items: { type: "string" } },
          evidence: { type: "string" },
        },
        required: ["company", "title", "location", "start", "end", "bullets", "evidence"],
        additionalProperties: false,
      },
    },
    education: {
      type: "array",
      items: {
        type: "object",
        properties: {
          institution: { type: "string" },
          degree: { type: "string" },
          field: { type: ["string", "null"] },
          start: { type: ["string", "null"] },
          end: { type: ["string", "null"] },
          notes: { type: "array", items: { type: "string" } },
          evidence: { type: "string" },
        },
        required: ["institution", "degree", "field", "start", "end", "notes", "evidence"],
        additionalProperties: false,
      },
    },
    skills: {
      type: "array",
      items: {
        type: "object",
        properties: {
          name: { type: "string" },
          years: { type: ["integer", "null"] },
          evidence: { type: "string" },
        },
        required: ["name", "years", "evidence"],
        additionalProperties: false,
      },
    },
    answers: {
      type: "array",
      items: {
        type: "object",
        properties: { question: { type: "string" }, answer: { type: "string" }, evidence: { type: "string" } },
        required: ["question", "answer", "evidence"],
        additionalProperties: false,
      },
    },
    issues: { type: "array", items: { type: "string" } },
  },
  required: ["name", "email", "location", "links", "employment", "education", "skills", "answers", "issues"],
  additionalProperties: false,
} as const;

const ym = z.string().regex(/^\d{4}-\d{2}$/);
const extractOutput = z.object({
  name: z.string().nullable(),
  email: z.string().nullable(),
  location: z.string().nullable(),
  links: z.array(z.string()),
  employment: z.array(
    z.object({
      company: z.string(),
      title: z.string(),
      location: z.string().nullable(),
      start: z.string(),
      end: z.string().nullable(),
      bullets: z.array(z.string()),
      evidence: z.string(),
    }),
  ),
  education: z.array(
    z.object({
      institution: z.string(),
      degree: z.string(),
      field: z.string().nullable(),
      start: z.string().nullable(),
      end: z.string().nullable(),
      notes: z.array(z.string()),
      evidence: z.string(),
    }),
  ),
  skills: z.array(z.object({ name: z.string(), years: z.number().int().nullable(), evidence: z.string() })),
  answers: z.array(z.object({ question: z.string(), answer: z.string(), evidence: z.string() })),
  issues: z.array(z.string()),
});

export type ExtractOutput = z.infer<typeof extractOutput>;

/** One fact ready to insert: its kind, its data in the schema's shape, and the span it came from. */
export interface ExtractedFact {
  kind: "contact" | "link" | "employment" | "education" | "skill" | "answer";
  data: Record<string, unknown>;
  evidence: string;
}

/**
 * Reads the model's answer into facts the schemas accept. An item the
 * schema refuses, a date that is not YYYY-MM say, becomes an issue rather
 * than a fact, so a bad line never reaches the confirmation screen as if it
 * were good.
 */
export function factsFrom(out: ExtractOutput): { facts: ExtractedFact[]; issues: string[] } {
  const facts: ExtractedFact[] = [];
  const issues = [...out.issues];
  if (out.name || out.email || out.location) {
    facts.push({ kind: "contact", data: { name: out.name, email: out.email, location: out.location }, evidence: [out.name, out.email, out.location].filter(Boolean).join(", ") });
  }
  for (const l of out.links) facts.push({ kind: "link", data: { url: l }, evidence: l });
  for (const e of out.employment) {
    const r = employmentFact.safeParse({ company: e.company, title: e.title, location: e.location ?? undefined, start: e.start, end: e.end ?? undefined, bullets: e.bullets.filter(Boolean) });
    if (r.success) facts.push({ kind: "employment", data: r.data, evidence: e.evidence });
    else issues.push(`${e.title} at ${e.company}: ${r.error.issues.map((i) => `${i.path.join(".")} ${i.message}`).join("; ")}`);
  }
  for (const e of out.education) {
    const r = educationFact.safeParse({
      institution: e.institution,
      degree: e.degree,
      field: e.field ?? undefined,
      start: e.start && ym.safeParse(e.start).success ? e.start : undefined,
      end: e.end && ym.safeParse(e.end).success ? e.end : undefined,
      notes: e.notes.length ? e.notes : undefined,
    });
    if (r.success) facts.push({ kind: "education", data: r.data, evidence: e.evidence });
    else issues.push(`${e.degree}, ${e.institution}: ${r.error.issues.map((i) => i.message).join("; ")}`);
  }
  for (const s of out.skills) {
    const r = skillFact.safeParse({ name: s.name, years: s.years ?? undefined, evidence: s.evidence || undefined });
    if (r.success) facts.push({ kind: "skill", data: r.data, evidence: s.evidence });
    else issues.push(`skill ${s.name}: ${r.error.issues.map((i) => i.message).join("; ")}`);
  }
  for (const a of out.answers) {
    const r = answerFact.safeParse({ question: a.question, answer: a.answer });
    if (r.success) facts.push({ kind: "answer", data: r.data, evidence: a.evidence });
  }
  return { facts, issues };
}

export interface ExtractResult {
  facts: ExtractedFact[];
  issues: string[];
  model: string;
  usage: CallUsage;
  usd: number;
  ms: number;
}

export class ExtractError extends Error {
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

export type ResumeInput = { kind: "pdf"; filename: string; bytes: Buffer } | { kind: "text"; text: string };

/** One extraction call over a PDF or over plain text. Stores nothing. */
export async function extractCall(input: ResumeInput, opts: { model?: string } = {}): Promise<ExtractResult> {
  const model = opts.model ?? env().MODEL_EXTRACT ?? DEFAULT_MODEL;
  const content: PromptContent[] =
    input.kind === "pdf"
      ? [
          { type: "input_file", filename: input.filename, file_data: `data:application/pdf;base64,${input.bytes.toString("base64")}` },
          { type: "input_text", text: "Extract the facts from this resume." },
        ]
      : [{ type: "input_text", text: `RESUME\n\n${input.text}` }];
  const started = Date.now();
  let call;
  try {
    call = await structuredCall({
      model,
      instructions: INSTRUCTIONS,
      input: [{ role: "user", content }],
      schemaName: "resume_facts",
      schema: EXTRACT_SCHEMA,
      maxOutputTokens: MAX_OUTPUT_TOKENS,
      reasoning: REASONING,
      timeoutMs: TIMEOUT_MS,
    });
  } catch (e) {
    if (e instanceof CallError) throw new ExtractError(e.message, model, e.usage, e.usd, e.ms);
    throw new ExtractError(e instanceof Error ? e.message : String(e), model, null, 0, Date.now() - started);
  }
  let parsed: ExtractOutput;
  try {
    const r = extractOutput.safeParse(JSON.parse(call.text));
    if (!r.success) throw new Error(`model output does not match the schema: ${r.error.issues.map((i) => i.path.join(".")).join(", ")}`);
    parsed = r.data;
  } catch (e) {
    throw new ExtractError(e instanceof Error ? e.message : String(e), model, call.usage, call.usd, call.ms);
  }
  const { facts, issues } = factsFrom(parsed);
  return { facts, issues, model, usage: call.usage, usd: call.usd, ms: call.ms };
}

export interface UploadOutcome {
  documentId: string;
  facts: number;
  issues: string[];
  model: string;
  tokensIn: number;
  tokensOut: number;
  usd: number;
  ms: number;
}

/**
 * The upload path: stores the file as a processing document, extracts,
 * stores every fact as `extracted` with its evidence and document, marks
 * the document ready, writes the cost row. A failed call still writes its
 * cost row and marks the document failed with the reason, so a document
 * with no facts is never mistaken for a verified one and a call of unknown
 * cost leaves its mark where the cost report reads it. The document row and
 * the call are not one transaction, on purpose: nothing holds a
 * transaction open across a 40 s model call. A function killed mid call
 * leaves the document processing; the profile view reads a processing
 * document older than the call budget as failed.
 */
export async function extractUpload(
  db: DbPool | Tx,
  userId: string,
  file: { filename: string; bytes: Buffer },
  opts: { model?: string; run?: string | null } = {},
): Promise<UploadOutcome> {
  const [doc] = await db
    .insert(profileDocuments)
    .values({ userId, filename: file.filename, bytesPhase0: file.bytes, text: "", pageCount: 0, status: "processing" })
    .returning({ id: profileDocuments.id });
  const fail = async (message: string) => {
    await db.update(profileDocuments).set({ status: "failed", error: message.slice(0, 500) }).where(eq(profileDocuments.id, doc.id));
  };
  let result: ExtractResult;
  try {
    result = await extractCall({ kind: "pdf", filename: file.filename, bytes: file.bytes }, { model: opts.model });
  } catch (e) {
    const err = e instanceof ExtractError ? e : new ExtractError(e instanceof Error ? e.message : String(e), opts.model ?? DEFAULT_MODEL, null, 0, 0);
    if (err.usage) {
      // Recording the price of a failed call must not replace the reason it failed, nor leave the document processing.
      await recordCost(db, { kind: "extract", model: err.model, userId, refId: doc.id, tokensIn: err.usage.inputTokens, tokensCached: err.usage.cachedInputTokens, tokensOut: err.usage.outputTokens, usd: err.usd, ms: err.ms, run: opts.run ?? null });
    }
    await fail(err.message);
    throw err;
  }
  // A worksheet row that cannot be written does not throw away facts that have been paid for and read (finding 16).
  await recordCost(db, {
    kind: "extract",
    model: result.model,
    userId,
    refId: doc.id,
    tokensIn: result.usage.inputTokens,
    tokensCached: result.usage.cachedInputTokens,
    tokensOut: result.usage.outputTokens,
    usd: result.usd,
    ms: result.ms,
    run: opts.run ?? null,
  });
  // The facts and the document's ready state land together or not at all (D-027): a document could otherwise be left
  // processing or failed with its facts stored, refused by Confirm all and yet confirmable one by one. The model call stays
  // outside the transaction; only the stores are in it.
  try {
    await db.transaction(async (tx) => {
      if (result.facts.length) {
        await tx.insert(profileFacts).values(
          result.facts.map((f) => ({ userId, documentId: doc.id, kind: f.kind, data: f.data, evidence: f.evidence, origin: "upload" as const, status: "extracted" as const })),
        );
      }
      // The issues land with the facts: what could not be read is part of what was read (review four, finding 9).
      await tx.update(profileDocuments).set({ status: "ready", issues: result.issues }).where(eq(profileDocuments.id, doc.id));
    });
  } catch (e) {
    await fail(`storing the facts failed: ${e instanceof Error ? e.message : String(e)}`);
    throw e;
  }
  return {
    documentId: doc.id,
    facts: result.facts.length,
    issues: result.issues,
    model: result.model,
    tokensIn: result.usage.inputTokens,
    tokensOut: result.usage.outputTokens,
    usd: result.usd,
    ms: result.ms,
  };
}
