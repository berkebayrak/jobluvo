import { eq, sql } from "drizzle-orm";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { dbPool, type Tx } from "@/db/client";
import { costEvents, profileDocuments, profileFacts, users } from "@/db/schema";
import * as client from "@/server/llm/client";
import { unknownCostStats } from "@/server/match/report";
import { profileView } from "./confirm";
import { extractUpload, factsFrom, type ExtractOutput } from "./extract";
import { textPdf, wrap } from "./pdf";

vi.mock("@/server/llm/client", async (importOriginal) => {
  const real = await importOriginal<typeof import("@/server/llm/client")>();
  return { ...real, structuredCall: vi.fn() };
});
const call = () => vi.mocked(client.structuredCall);

const base: ExtractOutput = {
  name: "Jack Miller",
  email: "jack.miller@jobluvo.com",
  location: "Istanbul, Turkey",
  links: ["linkedin.com/in/jackmiller"],
  employment: [
    { company: "Arvento", title: "Head of Strategy and PMO", location: "Istanbul, Turkey", start: "2022-03", end: null, bullets: ["Lead the strategy function.", ""], evidence: "Head of Strategy and PMO, Arvento" },
  ],
  education: [{ institution: "Koc University", degree: "MBA", field: "Executive MBA, part time", start: "2018-09", end: "2020-06", notes: [], evidence: "MBA, Koc University" }],
  skills: [{ name: "SQL", years: 6, evidence: "SQL (6 years)" }],
  answers: [{ question: "Notice period", answer: "30 days", evidence: "Notice period: 30 days" }],
  issues: [],
};

describe("reading the extractor's answer into facts", () => {
  it("keeps every fact the schemas accept, with its kind and evidence, and drops an empty bullet", () => {
    const { facts, issues } = factsFrom(base);
    expect(issues).toEqual([]);
    expect(facts.map((f) => f.kind)).toEqual(["contact", "link", "employment", "education", "skill", "answer"]);
    const emp = facts.find((f) => f.kind === "employment")!;
    expect(emp.data).toEqual({ company: "Arvento", title: "Head of Strategy and PMO", location: "Istanbul, Turkey", start: "2022-03", bullets: ["Lead the strategy function."] });
    expect(emp.evidence).toBe("Head of Strategy and PMO, Arvento");
    expect(facts.find((f) => f.kind === "education")!.data).toMatchObject({ institution: "Koc University", degree: "MBA", start: "2018-09", end: "2020-06" });
  });
  it("turns a fact the schema refuses into an issue instead of a fact, so a bad date never reaches the screen as good", () => {
    const { facts, issues } = factsFrom({
      ...base,
      employment: [{ ...base.employment[0], start: "March 2022" }],
      education: [{ ...base.education[0], start: "2018", end: "unknown" }],
      issues: ["Second page is a scan and partly unreadable"],
    });
    expect(facts.some((f) => f.kind === "employment")).toBe(false);
    expect(issues[0]).toBe("Second page is a scan and partly unreadable");
    expect(issues[1]).toMatch(/Head of Strategy and PMO at Arvento: start/);
    // Education keeps the row and drops the dates it cannot read.
    const edu = facts.find((f) => f.kind === "education")!;
    expect(edu.data).toEqual({ institution: "Koc University", degree: "MBA", field: "Executive MBA, part time" });
  });
  it("writes no contact fact when the resume gives no name, email or location", () => {
    const { facts } = factsFrom({ ...base, name: null, email: null, location: null, links: [] });
    expect(facts.map((f) => f.kind)).toEqual(["employment", "education", "skill", "answer"]);
  });
});

describe("the PDF writer", () => {
  it("wraps long lines at words and keeps a bullet's indent", () => {
    expect(wrap("short line")).toEqual(["short line"]);
    const long = `- ${"word ".repeat(30).trim()}`;
    const lines = wrap(long, 60);
    expect(lines.length).toBeGreaterThan(1);
    expect(lines[0].length).toBeLessThanOrEqual(60);
    expect(lines[1].startsWith("  ")).toBe(true);
  });
  it("produces a well formed single font PDF whose text stream carries the lines", () => {
    const pdf = textPdf(["Jack Miller", "Head of Strategy (PMO)", ...Array.from({ length: 60 }, (_, i) => `line ${i}`)]).toString("latin1");
    expect(pdf.startsWith("%PDF-1.4")).toBe(true);
    expect(pdf.trimEnd().endsWith("%%EOF")).toBe(true);
    expect(pdf).toContain("/Type /Catalog");
    expect(pdf).toContain("/BaseFont /Helvetica");
    expect(pdf).toContain("(Jack Miller) Tj");
    expect(pdf).toContain("(Head of Strategy \\(PMO\\)) Tj");
    expect(pdf).toContain("/Count 2");
    const startxref = Number(/startxref\n(\d+)/.exec(pdf)![1]);
    expect(pdf.slice(startxref, startxref + 4)).toBe("xref");
  });
});

/*
 * The upload path against the real database with the model stubbed: the
 * document is processing during the call, ready with its facts after it,
 * and failed with the reason when the call fails, so a document with no
 * facts is never mistaken for a verified one. A call of unknown cost leaves
 * its mark on the document, where the cost report counts it. Skipped
 * without DATABASE_URL.
 */

const hasDb = !!process.env.DATABASE_URL;

class Rollback extends Error {}

async function withUser(fn: (tx: Tx, userId: string) => Promise<void>) {
  await dbPool()
    .transaction(async (tx) => {
      const stamp = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const [user] = await tx
        .insert(users)
        .values({ name: "Upload fixture", email: `upload-${stamp}@test.invalid`, jobluvoAddress: `upload-${stamp}@test.invalid` })
        .returning({ id: users.id });
      await fn(tx, user.id);
      throw new Rollback();
    })
    .catch((e) => {
      if (!(e instanceof Rollback)) throw e;
    });
}

const usage = { inputTokens: 1600, cachedInputTokens: 0, outputTokens: 1500, reasoningTokens: 0 };
const answer = (out: ExtractOutput) => ({ text: JSON.stringify(out), usage, usd: 0.002, ms: 12000 });
const file = { filename: "resume.pdf", bytes: Buffer.from("%PDF-1.4 fixture") };

afterAll(async () => {
  const g = globalThis as unknown as { __jobluvoPool?: { end(): Promise<void> } };
  await g.__jobluvoPool?.end();
});

afterEach(() => call().mockReset());

describe.skipIf(!hasDb)("the upload path and the document's state", () => {
  beforeAll(async () => {
    try {
      await dbPool().execute(sql`select 1`);
    } catch (e) {
      throw new Error(`DATABASE_URL is set but the database cannot be reached: ${e instanceof Error ? e.message : String(e)}`);
    }
  });

  it("a successful upload leaves a ready document with its facts extracted, and the view says check", async () => {
    await withUser(async (tx, userId) => {
      call().mockImplementationOnce(async () => {
        // During the call the document is processing.
        const [d] = await tx.select({ status: profileDocuments.status }).from(profileDocuments).where(eq(profileDocuments.userId, userId));
        expect(d.status).toBe("processing");
        return answer(base);
      });
      const out = await extractUpload(tx, userId, file);
      expect(out.facts).toBe(6);
      const view = await profileView(tx, userId);
      expect(view.documents).toEqual([expect.objectContaining({ id: out.documentId, status: "ready", state: "check", error: null, extracted: 6, confirmed: 0 })]);
      const cost = await tx.select({ kind: costEvents.kind }).from(costEvents).where(eq(costEvents.userId, userId));
      expect(cost).toEqual([{ kind: "extract" }]);
    });
  });

  it("an upload whose extractor finds nothing is ready and empty, never verified", async () => {
    await withUser(async (tx, userId) => {
      call().mockResolvedValueOnce(answer({ ...base, name: null, email: null, location: null, links: [], employment: [], education: [], skills: [], answers: [] }));
      const out = await extractUpload(tx, userId, file);
      expect(out.facts).toBe(0);
      const view = await profileView(tx, userId);
      expect(view.documents[0]).toMatchObject({ status: "ready", state: "empty", extracted: 0, confirmed: 0 });
    });
  });

  it("a failed call leaves a failed document with the reason and its cost row, and no facts", async () => {
    await withUser(async (tx, userId) => {
      call().mockRejectedValueOnce(new client.CallError("response incomplete: max_output_tokens", usage, 0.002, 40000));
      await expect(extractUpload(tx, userId, file)).rejects.toThrow(/incomplete/);
      const view = await profileView(tx, userId);
      expect(view.documents[0]).toMatchObject({ status: "failed", state: "failed", error: "response incomplete: max_output_tokens", extracted: 0 });
      expect(await tx.select().from(profileFacts).where(eq(profileFacts.userId, userId))).toEqual([]);
      const cost = await tx.select({ kind: costEvents.kind }).from(costEvents).where(eq(costEvents.userId, userId));
      expect(cost).toEqual([{ kind: "extract" }]);
    });
  });

  it("a call of unknown cost leaves its mark on the document, no cost row, and the cost report counts it", async () => {
    await withUser(async (tx, userId) => {
      const before = await unknownCostStats(tx);
      call().mockRejectedValueOnce(new client.CallUnknownError(`call timed out after 40000ms, ${client.UNKNOWN_COST_MARK}: the provider may have completed and billed it`, 40000));
      await expect(extractUpload(tx, userId, file)).rejects.toThrow(/cost unknown/);
      const view = await profileView(tx, userId);
      expect(view.documents[0]).toMatchObject({ status: "failed", state: "failed" });
      expect(view.documents[0].error).toContain(client.UNKNOWN_COST_MARK);
      expect(await tx.select().from(costEvents).where(eq(costEvents.userId, userId))).toEqual([]);
      const after = await unknownCostStats(tx);
      const rows = (s: typeof after) => s.find((x) => x.kind === "extract")!;
      expect(rows(after).unknownRows! - rows(before).unknownRows!).toBe(1);
    });
  });
});
