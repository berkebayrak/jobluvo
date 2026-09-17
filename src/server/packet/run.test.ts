import { eq, sql } from "drizzle-orm";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { dbPool, type Tx } from "@/db/client";
import { costEvents, jobs, packets, profileFacts, sources, users } from "@/db/schema";
import type { ScoringJob } from "@/server/match/score";
import { UNKNOWN_COST_MARK } from "@/server/llm/client";
import { resumeFacts } from "@/server/match/profile";
import { unknownCostStats } from "@/server/match/report";
import { ERROR_STORE, tailorJob } from "./run";
import * as tailor from "./tailor";

vi.mock("./tailor", async (importOriginal) => {
  const real = await importOriginal<typeof import("./tailor")>();
  return { ...real, tailorCall: vi.fn() };
});
const call = () => vi.mocked(tailor.tailorCall);

/*
 * The packet run over its cycle against the real database, with the model
 * stubbed: an answer with an invented value is rejected, the retry carries
 * the findings, a second rejection is stored as invalid rather than passed,
 * and every paid call leaves a cost row. Skipped without DATABASE_URL.
 */

const hasDb = !!process.env.DATABASE_URL;

class Rollback extends Error {}

const usage = { inputTokens: 2000, cachedInputTokens: 1200, outputTokens: 300, reasoningTokens: 0 };
const answer = (changes: { bullet: string; text: string; facts: string[] }[], summary: string | null = null, summaryFacts: string[] = []) =>
  ({ text: JSON.stringify({ summary, summary_facts: summaryFacts, changes, skills: [] }), model: "gpt-5.6-luna", usage, usd: 0.0005, ms: 100 }) satisfies tailor.TailorResult;

async function withFixture(fn: (tx: Tx, userId: string, job: ScoringJob) => Promise<void>) {
  await dbPool()
    .transaction(async (tx) => {
      const stamp = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const [user] = await tx
        .insert(users)
        .values({ name: "Packet fixture", email: `packet-${stamp}@test.invalid`, jobluvoAddress: `packet-${stamp}@test.invalid` })
        .returning({ id: users.id });
      await tx.insert(profileFacts).values([
        { userId: user.id, kind: "preference", origin: "user", status: "confirmed", data: { targetCountries: ["US"], relocation: "yes", remote: "remote_ok" } },
        {
          userId: user.id,
          kind: "employment",
          origin: "user",
          status: "confirmed",
          data: { company: "Arvento", title: "Head of Strategy", start: "2022-03", bullets: ["Ran a 3 year cost program that cut cost 11 percent.", "Own the annual planning cycle."] },
        },
        { userId: user.id, kind: "skill", origin: "user", status: "confirmed", data: { name: "Financial modelling", years: 10 } },
      ]);
      const [src] = await tx
        .insert(sources)
        .values({ family: "greenhouse", tenant: `packet-test-${stamp}`, companyName: "Fixture Co", companyDomain: null })
        .returning({ id: sources.id });
      const [row] = await tx
        .insert(jobs)
        .values({
          sourceId: src.id,
          family: "greenhouse",
          nativeId: "j",
          title: "Strategy Lead",
          titleNorm: "strategy lead",
          companyName: "Fixture Co",
          locations: [{ raw: "New York, NY", city: "New York", region: "NY", country: "US" }],
          workplace: "onsite",
          descriptionText: "Own planning.",
          descriptionHtml: "<p>Own planning.</p>",
          descriptionCore: "Own planning.",
          contentHash: "hash-j",
          applyUrl: "https://example.com/j",
          applyUrlNorm: "https://example.com/j",
        })
        .returning({ id: jobs.id });
      const job: ScoringJob = {
        id: row.id,
        title: "Strategy Lead",
        companyName: "Fixture Co",
        locations: [],
        workplace: "onsite",
        employmentType: null,
        seniority: null,
        compRaw: null,
        compMin: null,
        compMax: null,
        compCurrency: null,
        compPeriod: "unknown",
        descriptionCore: "Own planning.",
      };
      await fn(tx, user.id, job);
      throw new Rollback();
    })
    .catch((e) => {
      if (!(e instanceof Rollback)) throw e;
    });
}

afterAll(async () => {
  const g = globalThis as unknown as { __jobluvoPool?: { end(): Promise<void> } };
  await g.__jobluvoPool?.end();
});

afterEach(() => call().mockReset());

describe.skipIf(!hasDb)("packet run over its attempts", () => {
  beforeAll(async () => {
    try {
      await dbPool().execute(sql`select 1`);
    } catch (e) {
      throw new Error(`DATABASE_URL is set but the database cannot be reached: ${e instanceof Error ? e.message : String(e)}`);
    }
  });

  it("rejects an invented value, retries once with the findings, and stores the corrected answer as ready", async () => {
    await withFixture(async (tx, userId, job) => {
      const facts = (await resumeFacts(tx, userId))!;
      call()
        .mockResolvedValueOnce(answer([{ bullet: "R1.1", text: "Led a 3 year cost program that cut cost 14 percent.", facts: ["R1.1"] }]))
        .mockResolvedValueOnce(answer([{ bullet: "R1.1", text: "Led a 3 year cost program that cut cost 11 percent.", facts: ["R1.1"] }]));
      const out = await tailorJob(tx, facts, job, { run: "test" });
      expect(out.status).toBe("ready");
      expect(out.attempts).toBe(2);
      expect(out.findings.filter((f) => f.level === "hard")).toEqual([]);
      expect(out.changes).toBe(1);
      expect(out.tokensIn).toBe(4000);
      expect(out.usd).toBeCloseTo(0.001, 8);
      // The retry carried the rejection.
      const retry = call().mock.calls[1][2];
      expect(retry.retryOf).toEqual([expect.objectContaining({ level: "hard", bullet: "R1.1", value: "pct:14" })]);
      const [p] = await tx.select().from(packets).where(eq(packets.jobId, job.id));
      expect(p.status).toBe("ready");
      expect(p.attempts).toBe(2);
      expect(p.resume?.experience[0].bullets[0].text).toBe("Led a 3 year cost program that cut cost 11 percent.");
      expect(p.contentHash).toBe("hash-j");
      expect(p.factsHash).toBe(facts.factsHash);
      expect(p.resumeHash).not.toBeNull();
      const cost = await tx.select({ run: costEvents.run, kind: costEvents.kind }).from(costEvents).where(eq(costEvents.userId, userId));
      expect(cost).toEqual([
        { run: "test", kind: "tailor" },
        { run: "test", kind: "tailor" },
      ]);
    });
  });

  it("stores a second rejection as invalid with its findings, never as a pass", async () => {
    await withFixture(async (tx, userId, job) => {
      const facts = (await resumeFacts(tx, userId))!;
      call()
        .mockResolvedValueOnce(answer([{ bullet: "R1.1", text: "Cut cost 14 percent.", facts: ["R1.1"] }]))
        .mockResolvedValueOnce(answer([{ bullet: "R1.2", text: "Own the planning cycle for 7 business units.", facts: ["R1.2"] }], "Leader since 2019.", ["R1"]));
      const out = await tailorJob(tx, facts, job);
      expect(out.status).toBe("invalid");
      expect(out.attempts).toBe(2);
      expect(out.findings.filter((f) => f.level === "hard").map((f) => f.value).sort()).toEqual(["num:7", "year:2019"]);
      const [p] = await tx.select().from(packets).where(eq(packets.jobId, job.id));
      expect(p.status).toBe("invalid");
      expect(p.resume).toBeNull();
      expect(p.findings).toHaveLength(2);
    });
  });

  it("a soft finding travels with a ready packet, and a call that fails still writes its cost row", async () => {
    await withFixture(async (tx, userId, job) => {
      const facts = (await resumeFacts(tx, userId))!;
      call().mockResolvedValueOnce(answer([{ bullet: "R1.1", text: "Ran a 3 year program with KPI reporting, cutting cost 11 percent.", facts: ["R1.1"] }]));
      const ready = await tailorJob(tx, facts, job);
      expect(ready.status).toBe("ready");
      expect(ready.attempts).toBe(1);
      expect(ready.findings.map((f) => [f.level, f.value])).toEqual([["soft", "KPI"]]);

      call().mockReset();
      call().mockRejectedValue(new tailor.TailorError("response incomplete: max_output_tokens", "gpt-5.6-luna", usage, 0.0005, 50));
      const failed = await tailorJob(tx, facts, job);
      expect(failed.status).toBe("failed");
      expect(failed.error).toContain("incomplete");
      const [p] = await tx.select().from(packets).where(eq(packets.jobId, job.id));
      expect(p.status).toBe("failed");
      const cost = await tx.select({ usd: costEvents.usd }).from(costEvents).where(eq(costEvents.userId, userId));
      expect(cost).toHaveLength(2);
    });
  });
});

/*
 * A rejected candidate must never become the packet because the retry did
 * not produce a better one. Each case starts with an answer the validator
 * rejects (99 percent, the fact says 11) and follows it with a retry that
 * fails in a different way; the invented value must not reach the stored
 * packet under any of them.
 */
describe.skipIf(!hasDb)("a rejected candidate is never promoted by a failed retry", () => {
  const invented = answer([{ bullet: "R1.1", text: "Ran a 3 year cost program that cut cost 99 percent.", facts: ["R1.1"] }]);
  const malformed = { ...invented, text: "{not json" };
  const offSchema = { ...invented, text: JSON.stringify({ summary: null, changes: "none" }) };

  async function expectNothingShipped(tx: Tx, jobId: string, out: Awaited<ReturnType<typeof tailorJob>>) {
    expect(out.status).not.toBe("ready");
    expect(out.resume).toBeNull();
    const [p] = await tx.select().from(packets).where(eq(packets.jobId, jobId));
    expect(p.status).not.toBe("ready");
    expect(p.resume).toBeNull();
    expect(p.resumeHash).toBeNull();
    expect(JSON.stringify(p)).not.toContain("99 percent");
    return p;
  }

  it("invalid, then malformed JSON: failed, with no resume and no changes from the rejected attempt", async () => {
    await withFixture(async (tx, userId, job) => {
      const facts = (await resumeFacts(tx, userId))!;
      call().mockResolvedValueOnce(invented).mockResolvedValueOnce(malformed);
      const out = await tailorJob(tx, facts, job);
      const p = await expectNothingShipped(tx, job.id, out);
      expect(out.status).toBe("failed");
      expect(out.attempts).toBe(2);
      expect(out.attemptLog.map((a) => a.outcome)).toEqual(["invalid", "failed"]);
      expect(out.attemptLog[0].findings).toEqual([expect.objectContaining({ level: "hard", bullet: "R1.1", value: "pct:99" })]);
      expect(out.findings).toEqual([]);
      expect(out.changes).toBe(0);
      expect(p.changes).toEqual([]);
      expect(p.attempts).toBe(2);
      expect(p.error).toContain("attempt 1 invalid: 1 hard finding(s)");
      expect(p.error).toContain("attempt 2 failed");
      // The retry was asked to fix the rejection, and both calls were paid for.
      expect(call().mock.calls[1][2].retryOf).toHaveLength(1);
      const cost = await tx.select({ usd: costEvents.usd }).from(costEvents).where(eq(costEvents.userId, userId));
      expect(cost).toHaveLength(2);
    });
  });

  it("invalid, then a transport error: failed, one cost row, nothing from the rejected attempt", async () => {
    await withFixture(async (tx, userId, job) => {
      const facts = (await resumeFacts(tx, userId))!;
      call().mockResolvedValueOnce(invented).mockRejectedValueOnce(new Error("fetch failed: ECONNRESET"));
      const out = await tailorJob(tx, facts, job);
      const p = await expectNothingShipped(tx, job.id, out);
      expect(out.status).toBe("failed");
      expect(out.attempts).toBe(2);
      expect(out.attemptLog.map((a) => a.outcome)).toEqual(["invalid", "failed"]);
      expect(out.error).toContain("ECONNRESET");
      expect(p.changes).toEqual([]);
      expect(p.findings).toEqual([]);
      const cost = await tx.select({ usd: costEvents.usd }).from(costEvents).where(eq(costEvents.userId, userId));
      expect(cost).toHaveLength(1);
    });
  });

  it("invalid, then an incomplete response: failed, the cut off call still pays, nothing from the rejected attempt", async () => {
    await withFixture(async (tx, userId, job) => {
      const facts = (await resumeFacts(tx, userId))!;
      call()
        .mockResolvedValueOnce(invented)
        .mockRejectedValueOnce(new tailor.TailorError("response incomplete: max_output_tokens", "gpt-5.6-luna", usage, 0.0005, 50));
      const out = await tailorJob(tx, facts, job);
      const p = await expectNothingShipped(tx, job.id, out);
      expect(out.status).toBe("failed");
      expect(out.attempts).toBe(2);
      expect(out.error).toContain("incomplete");
      expect(p.error).toContain("attempt 1 invalid");
      expect(p.changes).toEqual([]);
      const cost = await tx.select({ usd: costEvents.usd }).from(costEvents).where(eq(costEvents.userId, userId));
      expect(cost).toHaveLength(2);
      expect(out.usd).toBeCloseTo(0.001, 8);
    });
  });

  it("invalid, then a corrected answer: ready, and the resume is the corrected attempt's own", async () => {
    await withFixture(async (tx, userId, job) => {
      const facts = (await resumeFacts(tx, userId))!;
      call()
        .mockResolvedValueOnce(invented)
        .mockResolvedValueOnce(answer([{ bullet: "R1.1", text: "Ran a 3 year cost program that cut cost 11 percent, leading it end to end.", facts: ["R1.1"] }]));
      const out = await tailorJob(tx, facts, job);
      expect(out.status).toBe("ready");
      expect(out.attempts).toBe(2);
      expect(out.attemptLog.map((a) => a.outcome)).toEqual(["invalid", "ready"]);
      expect(out.error).toBeUndefined();
      const [p] = await tx.select().from(packets).where(eq(packets.jobId, job.id));
      expect(p.status).toBe("ready");
      expect(p.resume?.experience[0].bullets[0].text).toBe("Ran a 3 year cost program that cut cost 11 percent, leading it end to end.");
      expect(p.changes).toHaveLength(1);
      expect(JSON.stringify(p)).not.toContain("99 percent");
      expect(p.error).toBeNull();
    });
  });

  it("invalid, then a timeout: failed with no cost row for the timed out call, and the cost report counts the row as unknown cost", async () => {
    await withFixture(async (tx, userId, job) => {
      const facts = (await resumeFacts(tx, userId))!;
      const before = await unknownCostStats(tx);
      call()
        .mockResolvedValueOnce(invented)
        .mockRejectedValueOnce(new tailor.TailorError(`call timed out after 20000ms, ${UNKNOWN_COST_MARK}: the provider may have completed and billed it`, "gpt-5.6-luna", null, 0, 20000));
      const out = await tailorJob(tx, facts, job);
      const p = await expectNothingShipped(tx, job.id, out);
      expect(out.status).toBe("failed");
      expect(p.error).toContain("attempt 2 failed: call timed out after 20000ms, cost unknown");
      const cost = await tx.select({ usd: costEvents.usd }).from(costEvents).where(eq(costEvents.userId, userId));
      expect(cost).toHaveLength(1);
      const after = await unknownCostStats(tx);
      const rows = (s: typeof after) => s.find((x) => x.kind === "tailor")!;
      expect(rows(after).unknownRows! - rows(before).unknownRows!).toBe(1);
      expect(rows(after).usdWorstCase! - rows(before).usdWorstCase!).toBeCloseTo(rows(after).usdMeanPerCall, 4);
      // Extraction is counted too, from the document rows.
      expect(typeof after.find((x) => x.kind === "extract")?.unknownRows).toBe("number");
    });
  });

  it("a long parse failure, then a timeout: the stored error keeps the unknown cost mark and the count still moves by one", async () => {
    await withFixture(async (tx, userId, job) => {
      const facts = (await resumeFacts(tx, userId))!;
      const before = await unknownCostStats(tx);
      // Thirty changes with every field missing: the schema error lists ninety issue paths, well over the 500 character store on its own.
      const fat = { ...invented, text: JSON.stringify({ summary: null, summary_facts: [], changes: Array.from({ length: 30 }, () => ({})), skills: [] }) };
      call()
        .mockResolvedValueOnce(fat)
        .mockRejectedValueOnce(new tailor.TailorError(`call timed out after 20000ms, ${UNKNOWN_COST_MARK}: the provider may have completed and billed it`, "gpt-5.6-luna", null, 0, 20000));
      const out = await tailorJob(tx, facts, job);
      expect(out.status).toBe("failed");
      expect(out.attemptLog[0].error!.length).toBeGreaterThan(ERROR_STORE);
      const [p] = await tx.select().from(packets).where(eq(packets.jobId, job.id));
      expect(p.error!.length).toBeLessThanOrEqual(ERROR_STORE);
      expect(p.error).toContain("attempt 1 failed: model output does not match the change set schema");
      expect(p.error).toContain("...");
      expect(p.error).toContain(`attempt 2 failed: call timed out after 20000ms, ${UNKNOWN_COST_MARK}`);
      expect(p.error).toBe(out.error);
      const after = await unknownCostStats(tx);
      const rows = (s: typeof after) => s.find((x) => x.kind === "tailor")!;
      expect(rows(after).unknownRows! - rows(before).unknownRows!).toBe(1);
    });
  });

  it("both attempts malformed: failed after two paid calls, with no candidate at all", async () => {
    await withFixture(async (tx, userId, job) => {
      const facts = (await resumeFacts(tx, userId))!;
      call().mockResolvedValueOnce(malformed).mockResolvedValueOnce(offSchema);
      const out = await tailorJob(tx, facts, job);
      const p = await expectNothingShipped(tx, job.id, out);
      expect(out.status).toBe("failed");
      expect(out.attempts).toBe(2);
      expect(out.attemptLog.map((a) => a.outcome)).toEqual(["failed", "failed"]);
      expect(out.changes).toBe(0);
      expect(p.changes).toEqual([]);
      expect(p.findings).toEqual([]);
      expect(p.error).toContain("attempt 1 failed");
      expect(p.error).toContain("does not match the change set schema");
      // A parse failure is retried with nothing to fix.
      expect(call().mock.calls[1][2].retryOf).toBeUndefined();
      const cost = await tx.select({ usd: costEvents.usd }).from(costEvents).where(eq(costEvents.userId, userId));
      expect(cost).toHaveLength(2);
    });
  });
});
