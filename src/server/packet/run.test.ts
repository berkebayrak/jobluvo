import { eq, sql } from "drizzle-orm";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { dbPool, endPool, type Tx } from "@/db/client";
import { costEvents, jobs, packets, profileFacts, sources, users } from "@/db/schema";
import { COST_NOT_RECORDED } from "@/server/cost";
import type { ScoringJob } from "@/server/match/score";
import { UNKNOWN_COST_MARK } from "@/server/llm/client";
import { resumeFacts } from "@/server/match/profile";
import { unknownCostStats } from "@/server/match/report";
import { consumableResume, ERROR_STORE, tailorJob } from "./run";
import { VALIDATOR_REVISION } from "./validate";
import * as tailor from "./tailor";
import * as validate from "./validate";

vi.mock("./tailor", async (importOriginal) => {
  const real = await importOriginal<typeof import("./tailor")>();
  return { ...real, tailorCall: vi.fn() };
});
vi.mock("./validate", async (importOriginal) => {
  const real = await importOriginal<typeof import("./validate")>();
  return { ...real, factSet: vi.fn(real.factSet), validateChangeSet: vi.fn(real.validateChangeSet) };
});
const call = () => vi.mocked(tailor.tailorCall);

/**
 * A handle whose every insert into the cost worksheet throws, and whose other
 * writes work. The throw is synchronous, at `db.insert(costEvents)`, so it
 * never reaches the database and the surrounding transaction stays usable:
 * this injects a worksheet write that fails on its own, which is what
 * recordCost is there to survive (finding 16).
 */
function costInsertFails(tx: Tx): Tx {
  return new Proxy(tx, {
    get(target, key, receiver) {
      if (key === "transaction") {
        const real = Reflect.get(target, key, receiver) as Tx["transaction"];
        return ((cb: (inner: Tx) => Promise<unknown>) => real.call(target, (inner: Tx) => cb(costInsertFails(inner)))) as Tx["transaction"];
      }
      if (key === "insert") {
        const real = Reflect.get(target, key, receiver) as Tx["insert"];
        return ((table: unknown) => {
          if (table === costEvents) throw new Error("injected cost insert failure");
          return real.call(target, table as never);
        }) as Tx["insert"];
      }
      return Reflect.get(target, key, receiver);
    },
  });
}
/** The findings that say something about the answer, without the soft provenance line a retry carries (finding 14). */
const holding = <T extends { message: string }>(fs: T[]): T[] => fs.filter((f) => f.message !== "this answer is a retry");
const realValidate = await vi.importActual<typeof import("./validate")>("./validate");

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
        contentHash: "hash-j",
      };
      await fn(tx, user.id, job);
      throw new Rollback();
    })
    .catch((e) => {
      if (!(e instanceof Rollback)) throw e;
    });
}

afterAll(async () => {
  await endPool();
});

afterEach(() => {
  call().mockReset();
  vi.mocked(validate.factSet).mockReset().mockImplementation(realValidate.factSet);
  vi.mocked(validate.validateChangeSet).mockReset().mockImplementation(realValidate.validateChangeSet);
});

describe.skipIf(!hasDb)("packet run over its attempts", () => {
  beforeAll(async () => {
    try {
      await dbPool().execute(sql`select 1`);
    } catch (e) {
      throw new Error(`DATABASE_URL is set but the database cannot be reached: ${e instanceof Error ? e.message : String(e)}`);
    }
  });

  it("puts back a clean line the retry dropped, validates the merged set, and says the packet is a retry", async () => {
    await withFixture(async (tx, userId, job) => {
      const facts = (await resumeFacts(tx, userId))!;
      call()
        // The first answer invents a value on R1.1 and edits R1.2 cleanly.
        .mockResolvedValueOnce(
          answer([
            { bullet: "R1.1", text: "Led a 3 year cost program that cut cost 14 percent.", facts: ["R1.1"] },
            { bullet: "R1.2", text: "Own the annual planning cycle end to end.", facts: ["R1.2"] },
          ]),
        )
        // The retry fixes R1.1 and silently drops R1.2, which is the behaviour finding 14 is about.
        .mockResolvedValueOnce(answer([{ bullet: "R1.1", text: "Led a 3 year cost program that cut cost 11 percent.", facts: ["R1.1"] }]));
      const out = await tailorJob(tx, facts, job, { run: "retry-merge" });
      expect(out.status).toBe("ready");
      // The clean line the retry dropped is in the packet, with the first answer's text.
      const bullets = out.changeSet!.changes.map((c) => c.bullet).sort();
      expect(bullets).toEqual(["R1.1", "R1.2"]);
      expect(out.changeSet!.changes.find((c) => c.bullet === "R1.2")!.text).toBe("Own the annual planning cycle end to end.");
      // The invented value is gone: the retry's text won on the line it was asked to fix.
      expect(out.changeSet!.changes.find((c) => c.bullet === "R1.1")!.text).toContain("11 percent");
      // The packet says how it was reached, and a soft finding does not hold it.
      const retry = out.findings.find((f) => f.message === "this answer is a retry");
      expect(retry?.level).toBe("soft");
      expect(retry?.detail).toBe("the retry dropped 1 of 2 edited lines; 1 line the validator had not objected to was put back from the answer before it");
      expect(out.attemptLog[1]!.retry).toBe(retry?.detail);
      const [row] = await tx.select({ status: packets.status, changes: packets.changes }).from(packets).where(eq(packets.jobId, job.id));
      expect(row.status).toBe("ready");
      expect(row.changes.map((c) => c.bullet).sort()).toEqual(["R1.1", "R1.2"]);
    });
  });

  it("does not put back a line the validator objected to, so a rejected claim cannot return through the merge", async () => {
    await withFixture(async (tx, userId, job) => {
      const facts = (await resumeFacts(tx, userId))!;
      call()
        // Both edited lines invent a value, so neither is clean.
        .mockResolvedValueOnce(
          answer([
            { bullet: "R1.1", text: "Led a 3 year cost program that cut cost 14 percent.", facts: ["R1.1"] },
            { bullet: "R1.2", text: "Own the annual planning cycle for 7 business units.", facts: ["R1.2"] },
          ]),
        )
        .mockResolvedValueOnce(answer([{ bullet: "R1.1", text: "Led a 3 year cost program that cut cost 11 percent.", facts: ["R1.1"] }]));
      const out = await tailorJob(tx, facts, job, { run: "retry-merge-objected" });
      expect(out.changeSet!.changes.map((c) => c.bullet)).toEqual(["R1.1"]);
      expect(out.findings.find((f) => f.message === "this answer is a retry")?.detail).toBe("the retry dropped 1 of 2 edited lines");
    });
  });

  it("stores the packet when the cost row cannot be written, and says so in the log rather than throwing", async () => {
    await withFixture(async (tx, userId, job) => {
      const facts = (await resumeFacts(tx, userId))!;
      const errors = vi.spyOn(console, "error").mockImplementation(() => {});
      call().mockResolvedValueOnce(answer([{ bullet: "R1.1", text: "Ran a 3 year cost program that cut cost 11 percent.", facts: ["R1.1"] }]));
      // The call is paid for and the answer passes; only the worksheet write fails.
      const out = await tailorJob(costInsertFails(tx), facts, job, { run: "cost-fault" });
      expect(out.status).toBe("ready");
      expect(out.resume).not.toBeNull();
      // The packet is stored, which is the whole point: a paid, validated answer is not thrown away over its receipt.
      const [row] = await tx.select({ status: packets.status, usd: packets.usd }).from(packets).where(eq(packets.jobId, job.id));
      expect(row.status).toBe("ready");
      expect(Number(row.usd)).toBeCloseTo(0.0005, 8);
      // No row was written, and the loss is not silent.
      expect(await tx.select().from(costEvents).where(eq(costEvents.refId, job.id))).toEqual([]);
      expect(errors.mock.calls.flat().join(" ")).toContain(COST_NOT_RECORDED);
      // The packet still carries the total it spent, so reconciliation can see the row is missing.
      errors.mockRestore();
    });
  });

  it("keeps the reason a call failed when the cost row for that failed call cannot be written either", async () => {
    await withFixture(async (tx, userId, job) => {
      const facts = (await resumeFacts(tx, userId))!;
      const errors = vi.spyOn(console, "error").mockImplementation(() => {});
      call().mockRejectedValue(new tailor.TailorError("response incomplete: max_output_tokens", "gpt-5.6-luna", usage, 0.0005, 50));
      const out = await tailorJob(costInsertFails(tx), facts, job, { run: "cost-fault-2" });
      expect(out.status).toBe("failed");
      // The stored reason is the model's, not the worksheet's.
      const [row] = await tx.select({ status: packets.status, error: packets.error }).from(packets).where(eq(packets.jobId, job.id));
      expect(row.status).toBe("failed");
      expect(row.error).toContain("response incomplete: max_output_tokens");
      expect(row.error).not.toContain("injected cost insert failure");
      expect(errors.mock.calls.flat().join(" ")).toContain(COST_NOT_RECORDED);
      errors.mockRestore();
    });
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

  it("stores the retained attempt's complete change set, its number and the validator revision; a held answer kept over a rejected retry is attempt 1", async () => {
    await withFixture(async (tx, userId, job) => {
      const facts = (await resumeFacts(tx, userId))!;
      // Held, not rejected: every value is on the profile and the only complaint is the citation, which no longer
      // decides anything but still says the answer is confused. A name in no fact rejects the packet now (D-034).
      const held = { bullet: "R1.1", text: "Ran a 3 year cost program that cut cost 11 percent.", facts: ["R9.9"] };
      call()
        .mockResolvedValueOnce(answer([held], "Strategy lead who cuts cost.", ["R1.1"]))
        .mockResolvedValueOnce(answer([{ bullet: "R1.1", text: "Cut cost 14 percent.", facts: ["R1.1"] }]));
      const out = await tailorJob(tx, facts, job);
      expect(out.status).toBe("needs_review");
      expect(out.attempts).toBe(2);
      expect(out.selected).toBe(0);
      expect(out.changeSet).toEqual({ summary: "Strategy lead who cuts cost.", summaryFacts: ["R1.1"], changes: [held], skills: [] });
      const [p] = await tx.select().from(packets).where(eq(packets.jobId, job.id));
      expect(p.attempt).toBe(1);
      expect(p.changeSet).toEqual(out.changeSet);
      expect(p.validatorRev).toBe(VALIDATOR_REVISION);
      expect(p.contentHash).toBe("hash-j");
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
      expect(p.findings.filter((f) => f.level === "hard")).toHaveLength(2);
      // "Leader" opens the summary, is not a verb and is on no fact: held (D-036). The packet is invalid on its values regardless.
      expect(p.findings.filter((f) => f.level === "review").map((f) => f.value)).toEqual(["Leader"]);
    });
  });

  it("a name in no fact holds the packet, keeps the resume, and does not spend a second call on a guess", async () => {
    await withFixture(async (tx, userId, job) => {
      const facts = (await resumeFacts(tx, userId))!;
      const line = { bullet: "R1.1", text: "Ran a 3 year program with KPI reporting, cutting cost 11 percent.", facts: ["R1.1"] };
      call().mockResolvedValueOnce(answer([line])).mockResolvedValueOnce(answer([line]));
      const out = await tailorJob(tx, facts, job);
      // "KPI" is on no fact, read from the shape of the word. A guess holds the packet and never destroys the work (D-036),
      // and it is not on the actionable list, so no second paid call is spent asking a model to fix a guess.
      expect(out.status).toBe("needs_review");
      expect(out.attempts).toBe(1);
      expect(call()).toHaveBeenCalledTimes(1);
      expect(holding(out.findings).map((f) => [f.level, f.value])).toEqual([["review", "KPI"]]);
      const [p] = await tx.select().from(packets).where(eq(packets.jobId, job.id));
      expect(p.status).toBe("needs_review");
      expect(p.resume).not.toBeNull();
      expect(p.resume?.experience[0].bullets[0].text).toBe(line.text);
      // The one door downstream: a held packet's resume does not leave through it, a ready one's does.
      expect(consumableResume(p)).toBeNull();
      expect(consumableResume({ ...p, status: "ready" })).toEqual(p.resume);
    });
  });

  it("a held packet keeps its resume for the review screen, and it does not leave through the door downstream", async () => {
    await withFixture(async (tx, userId, job) => {
      const facts = (await resumeFacts(tx, userId))!;
      // Held: every value is on the profile, and the only complaint is that the cited fact does not exist.
      const line = { bullet: "R1.1", text: "Ran a 3 year cost program that cut cost 11 percent.", facts: ["R9.9"] };
      call().mockResolvedValueOnce(answer([line])).mockResolvedValueOnce(answer([line]));
      const held = await tailorJob(tx, facts, job);
      expect(held.status).toBe("needs_review");
      expect(held.attempts).toBe(2);
      expect(holding(held.findings).map((f) => [f.level, f.value])).toEqual([["review", "R9.9"]]);
      // The retry returned the same answer, so nothing was dropped and nothing was put back; the packet still says it is a retry.
      expect(held.findings.find((f) => f.message === "this answer is a retry")?.detail).toBe("the retry kept every edited line, substituted");
      expect(held.resume?.experience[0].bullets[0].text).toBe(line.text);
      const [p] = await tx.select().from(packets).where(eq(packets.jobId, job.id));
      expect(p.status).toBe("needs_review");
      expect(p.resume).not.toBeNull();
      expect(p.resumeHash).not.toBeNull();
      expect(consumableResume(p)).toBeNull();
      expect(consumableResume({ ...p, status: "ready" })).toEqual(p.resume);
      expect(consumableResume({ ...p, status: "invalid", resume: null })).toBeNull();
    });
  });

  it("a retry that substitutes the fact's word clears the hold; one that comes back rejected does not replace the held answer", async () => {
    await withFixture(async (tx, userId, job) => {
      const facts = (await resumeFacts(tx, userId))!;
      const heldLine = { bullet: "R1.1", text: "Ran a 3 year cost program that cut cost 11 percent.", facts: ["R9.9"] };
      call().mockResolvedValueOnce(answer([heldLine])).mockResolvedValueOnce(answer([{ bullet: "R1.1", text: "Ran a 3 year cost program that cut cost 11 percent.", facts: ["R1.1"] }]));
      const cleared = await tailorJob(tx, facts, job);
      expect(cleared.status).toBe("ready");
      expect(cleared.attempts).toBe(2);
      expect(holding(cleared.findings)).toEqual([]);
      expect(cleared.findings.map((f) => f.level)).toEqual(["soft"]);
      expect(cleared.attemptLog.map((a) => a.outcome)).toEqual(["needs_review", "ready"]);
      expect(cleared.resume?.experience[0].bullets[0].text).toBe("Ran a 3 year cost program that cut cost 11 percent.");

      call().mockReset();
      call().mockResolvedValueOnce(answer([heldLine])).mockResolvedValueOnce(answer([{ bullet: "R1.1", text: "Ran a 3 year program that cut cost 14 percent.", facts: ["R1.1"] }]));
      const kept = await tailorJob(tx, facts, job);
      expect(kept.status).toBe("needs_review");
      expect(kept.attempts).toBe(2);
      expect(kept.attemptLog.map((a) => a.outcome)).toEqual(["needs_review", "invalid"]);
      // The held answer was validated; the rejected retry does not take its place.
      expect(kept.resume?.experience[0].bullets[0].text).toBe(heldLine.text);
      expect(kept.findings.map((f) => f.value)).toEqual(["R9.9"]);
      const [row] = await tx.select().from(packets).where(eq(packets.jobId, job.id));
      expect(row.status).toBe("needs_review");
      expect(row.attempts).toBe(2);
    });
  });

  it("a clean rewording is ready with no findings, and a call that fails still writes its cost row", async () => {
    await withFixture(async (tx, userId, job) => {
      const facts = (await resumeFacts(tx, userId))!;
      // "Owned" opens the line: a verb, not a name (D-022). Nothing is held and nothing travels.
      call().mockResolvedValueOnce(answer([{ bullet: "R1.1", text: "Owned a 3 year program that cut cost 11 percent.", facts: ["R1.1"] }]));
      const ready = await tailorJob(tx, facts, job);
      expect(ready.status).toBe("ready");
      expect(ready.attempts).toBe(1);
      expect(ready.findings).toEqual([]);

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
describe.skipIf(!hasDb)("a validator that throws is a failed packet, not an aborted run", () => {
  it("throwing on the answer: failed, the error stored, the call's cost row kept, no paid retry", async () => {
    await withFixture(async (tx, userId, job) => {
      const facts = (await resumeFacts(tx, userId))!;
      call().mockResolvedValueOnce(answer([{ bullet: "R1.1", text: "Used constructor injection.", facts: ["R1.1"] }]));
      vi.mocked(validate.validateChangeSet).mockImplementationOnce(() => {
        throw new TypeError("n.toFixed is not a function");
      });
      const out = await tailorJob(tx, facts, job, { run: "test" });
      expect(out.status).toBe("failed");
      expect(out.attempts).toBe(1);
      expect(call()).toHaveBeenCalledTimes(1);
      expect(out.resume).toBeNull();
      const [p] = await tx.select().from(packets).where(eq(packets.jobId, job.id));
      expect(p.status).toBe("failed");
      expect(p.error).toBe("validator failed: n.toFixed is not a function");
      expect(p.attempts).toBe(1);
      expect(await tx.select({ kind: costEvents.kind }).from(costEvents).where(eq(costEvents.userId, userId))).toEqual([{ kind: "tailor" }]);
    });
  });

  it("throwing on the facts: failed before any call, zero attempts, no cost row", async () => {
    await withFixture(async (tx, userId, job) => {
      const facts = (await resumeFacts(tx, userId))!;
      vi.mocked(validate.factSet).mockImplementationOnce(() => {
        throw new TypeError("n.toFixed is not a function");
      });
      const out = await tailorJob(tx, facts, job, { run: "test" });
      expect(out.status).toBe("failed");
      expect(out.attempts).toBe(0);
      expect(call()).not.toHaveBeenCalled();
      const [p] = await tx.select().from(packets).where(eq(packets.jobId, job.id));
      expect(p.status).toBe("failed");
      expect(p.attempts).toBe(0);
      expect(p.error).toBe("validator failed reading the facts: n.toFixed is not a function");
      expect(await tx.select({ kind: costEvents.kind }).from(costEvents).where(eq(costEvents.userId, userId))).toEqual([]);
    });
  });
});

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
