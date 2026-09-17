import { eq, sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { dbPool, type Tx } from "@/db/client";
import { jobs, sources, type Source } from "@/db/schema";
import { applyPostings, claimBatch, knownJobs } from "./ingest";
import type { RawPosting } from "./types";

/*
 * Ingest over successive cycles against the real database, inside one
 * transaction that is rolled back at the end. The failures that matter
 * happen where the adapter's report and the stored row interact, so these
 * tests feed the ingest what an adapter would return on poll 1, poll 2 and
 * poll 3 and read the row back each time. Skipped without DATABASE_URL.
 */

const hasDb = !!process.env.DATABASE_URL;

class Rollback extends Error {}

const BODY = `<p>${"We build payments infrastructure for the internet and this role owns the ledger. ".repeat(3)}</p>
<p>${"Candidates must have the right to work in Ireland by the start date. ".repeat(2)}</p>`;

function posting(over: Partial<RawPosting> = {}): RawPosting {
  return {
    nativeId: "sr-1",
    title: "Ledger Engineer",
    locations: [{ raw: "Dublin, Ireland", city: "Dublin", countryCode: "IE" }],
    descriptionHtml: BODY,
    applyUrl: "https://jobs.smartrecruiters.com/acme/sr-1",
    listHash: "h1",
    detail: "fetched",
    native: {},
    ...over,
  };
}

async function withSource(fn: (tx: Tx, source: Source) => Promise<void>) {
  await dbPool()
    .transaction(async (tx) => {
      const [source] = await tx
        .insert(sources)
        .values({ family: "smartrecruiters", tenant: `ingest-test-${Date.now()}`, companyName: "Acme", companyDomain: "acme.example" })
        .returning();
      await fn(tx, source);
      throw new Rollback();
    })
    .catch((e) => {
      if (!(e instanceof Rollback)) throw e;
    });
}

async function row(tx: Tx, sourceId: string) {
  const [r] = await tx
    .select({
      descriptionText: jobs.descriptionText,
      detailPending: jobs.detailPending,
      eligibility: jobs.eligibility,
      contentHash: jobs.contentHash,
      listHash: jobs.listHash,
      missedPolls: jobs.missedPolls,
      closedAt: jobs.closedAt,
    })
    .from(jobs)
    .where(eq(jobs.sourceId, sourceId));
  return r;
}

afterAll(async () => {
  const g = globalThis as unknown as { __jobluvoPool?: { end(): Promise<void> } };
  await g.__jobluvoPool?.end();
});

describe.skipIf(!hasDb)("ingest over successive SmartRecruiters polls", () => {
  beforeAll(async () => {
    try {
      await dbPool().execute(sql`select 1`);
    } catch (e) {
      throw new Error(`DATABASE_URL is set but the database cannot be reached: ${e instanceof Error ? e.message : String(e)}`);
    }
  });

  it("an unchanged posting keeps its body and signals across repeated polls", async () => {
    await withSource(async (tx, source) => {
      // Poll 1: the body is fetched.
      await applyPostings(tx, source, [posting()], await knownJobs(tx, source.id));
      const first = await row(tx, source.id);
      expect(first.descriptionText).toContain("owns the ledger");
      expect(first.eligibility).toBe("right_to_work");
      expect(first.detailPending).toBe(false);

      // Polls 2 and 3: the list is unchanged, the adapter reports "stored" with no body.
      for (let i = 0; i < 2; i += 1) {
        const out = await applyPostings(tx, source, [posting({ descriptionHtml: "", detail: "stored" })], await knownJobs(tx, source.id));
        expect(out.updated).toBe(0);
        const again = await row(tx, source.id);
        expect(again.descriptionText).toBe(first.descriptionText);
        expect(again.eligibility).toBe("right_to_work");
        expect(again.contentHash).toBe(first.contentHash);
        expect(again.detailPending).toBe(false);
        expect(again.missedPolls).toBe(0);
      }
    });
  });

  it("a changed posting over budget keeps the old body and is marked pending until the detail arrives", async () => {
    await withSource(async (tx, source) => {
      await applyPostings(tx, source, [posting()], await knownJobs(tx, source.id));
      const before = await row(tx, source.id);

      // Poll 2: the listing changed, the budget was exhausted, the adapter reports "pending".
      const out = await applyPostings(tx, source, [posting({ descriptionHtml: "", listHash: "h2", detail: "pending" })], await knownJobs(tx, source.id));
      expect(out.detailPending).toBe(1);
      const pending = await row(tx, source.id);
      expect(pending.descriptionText).toBe(before.descriptionText);
      expect(pending.detailPending).toBe(true);

      // The next poll sees a pending row, so the adapter would skip the etag; the detail arrives.
      const known = await knownJobs(tx, source.id);
      expect([...known.values()].some((k) => k.detailPending)).toBe(true);
      await applyPostings(tx, source, [posting({ title: "Ledger Engineer II", listHash: "h2", detail: "fetched" })], known);
      const after = await row(tx, source.id);
      expect(after.detailPending).toBe(false);
      expect(after.listHash).toBe("h2");
      expect(after.descriptionText).toContain("owns the ledger");
    });
  });

  it("a posting never fetched is stored pending with no body, and hidden until it arrives", async () => {
    await withSource(async (tx, source) => {
      const out = await applyPostings(tx, source, [posting({ descriptionHtml: "", detail: "pending" })], await knownJobs(tx, source.id));
      expect(out.inserted).toBe(1);
      expect(out.detailPending).toBe(1);
      const r = await row(tx, source.id);
      expect(r.detailPending).toBe(true);
      expect(r.descriptionText).toBe("");
    });
  });
});

describe.skipIf(!hasDb)("closing over successive snapshots", () => {
  it("two valid empty snapshots close the listings; a single one only counts a miss", async () => {
    await withSource(async (tx, source) => {
      await applyPostings(tx, source, [posting()], await knownJobs(tx, source.id));
      const one = await applyPostings(tx, source, [], await knownJobs(tx, source.id));
      expect(one.closed).toBe(0);
      const afterOne = await row(tx, source.id);
      expect(afterOne.missedPolls).toBe(1);
      expect(afterOne.closedAt).toBeNull();

      const two = await applyPostings(tx, source, [], await knownJobs(tx, source.id));
      expect(two.closed).toBe(1);
      const afterTwo = await row(tx, source.id);
      expect(afterTwo.closedAt).not.toBeNull();

      // The listing comes back: reopened, counter reset.
      await applyPostings(tx, source, [posting()], await knownJobs(tx, source.id));
      const back = await row(tx, source.id);
      expect(back.closedAt).toBeNull();
      expect(back.missedPolls).toBe(0);
    });
  });
});

describe.skipIf(!hasDb)("overlapping claims", () => {
  it("two concurrent claims never hand out the same source", async () => {
    const db = dbPool();
    const tenants = [`claim-test-a-${Date.now()}`, `claim-test-b-${Date.now()}`];
    const inserted = await db
      .insert(sources)
      .values(tenants.map((tenant) => ({ family: "gem" as const, tenant, companyName: "Claim fixture", companyDomain: null })))
      .returning({ id: sources.id });
    try {
      // Both fixtures have no attempt yet, so they sit at the front of the queue.
      const [a, b] = await Promise.all([claimBatch(db, 1), claimBatch(db, 1)]);
      const got = [...a, ...b].map((s) => s.id);
      expect(got).toHaveLength(2);
      expect(new Set(got).size).toBe(2);
      for (const s of [...a, ...b]) {
        expect(s.lastStatus).toBe("polling");
        expect(s.lastAttemptAt).not.toBeNull();
      }
    } finally {
      await db.delete(sources).where(sql`${sources.id} in (${sql.join(inserted.map((r) => sql`${r.id}::uuid`), sql`, `)})`);
    }
  });
});
