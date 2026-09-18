import { eq, sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { dbPool, endPool, type Tx } from "@/db/client";
import { jobs, matches, sources, swipeDecisions, users, type JobLocation } from "@/db/schema";
import type { PreferenceFact } from "@/server/profile/facts";
import { claimMatches, MAX_ATTEMPTS, type ClaimKeys } from "./claim";
import type { FilterFacts } from "./hardFilter";

/*
 * The two step claim over cycles against the real database, inside one
 * rolled back transaction. What matters is what a second claim sees after
 * the first, so every test claims, changes a row the way the run or the
 * world would, and claims again. Skipped without DATABASE_URL.
 */

const hasDb = !!process.env.DATABASE_URL;

class Rollback extends Error {}

/** The fixtures target a country no real posting names, so the claim over the shared database sees only them. */
const PREFS: PreferenceFact = { targetCountries: ["ZZ"], relocation: "yes", remote: "remote_ok", employmentTypes: ["Full time"] };
const FACTS: FilterFacts = { prefs: PREFS, auth: [], sponsorship: null };
const ZZ: JobLocation[] = [{ raw: "Fixture City, ZZ", city: "Fixture City", country: "ZZ" }];
const FR: JobLocation[] = [{ raw: "Paris, France", city: "Paris", country: "FR" }];

interface Fixture {
  name: string;
  locations?: JobLocation[];
  daysAgo?: number;
  detailPending?: boolean;
}

async function insertJobs(tx: Tx, sourceId: string, fixtures: Fixture[]): Promise<Record<string, string>> {
  const rows = await tx
    .insert(jobs)
    .values(
      fixtures.map((f) => ({
        sourceId,
        family: "greenhouse" as const,
        nativeId: f.name,
        title: `Fixture ${f.name}`,
        titleNorm: `fixture ${f.name}`,
        companyName: "Fixture Co",
        companyDomain: null,
        locations: f.locations ?? ZZ,
        workplace: "onsite" as const,
        employmentType: "Full time",
        descriptionText: "body",
        descriptionHtml: "<p>body</p>",
        descriptionCore: "body",
        contentHash: `hash-${f.name}`,
        applyUrl: `https://example.com/${f.name}`,
        applyUrlNorm: `https://example.com/${f.name}`,
        firstSeenAt: new Date(Date.now() - (f.daysAgo ?? 0) * 86_400_000),
        detailPending: f.detailPending ?? false,
      })),
    )
    .returning({ id: jobs.id, nativeId: jobs.nativeId });
  return Object.fromEntries(rows.map((r) => [r.nativeId, r.id]));
}

async function withFixtures(fixtures: Fixture[], fn: (tx: Tx, ids: Record<string, string>, keys: ClaimKeys) => Promise<void>) {
  await dbPool()
    .transaction(async (tx) => {
      const stamp = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const [user] = await tx
        .insert(users)
        .values({ name: "Claim fixture", email: `claim-${stamp}@test.invalid`, jobluvoAddress: `claim-${stamp}@test.invalid` })
        .returning({ id: users.id });
      const [src] = await tx
        .insert(sources)
        .values({ family: "greenhouse", tenant: `claim-test-${stamp}`, companyName: "Fixture Co", companyDomain: null })
        .returning({ id: sources.id });
      const ids = await insertJobs(tx, src.id, fixtures);
      await fn(tx, ids, { userId: user.id, facts: FACTS, prefsHash: "prefs-1", factsHash: "facts-1" });
      throw new Rollback();
    })
    .catch((e) => {
      if (!(e instanceof Rollback)) throw e;
    });
}

async function matchOf(tx: Tx, userId: string, jobId: string) {
  const [m] = await tx
    .select({ id: matches.id, status: matches.status, attempts: matches.attempts, contentHash: matches.contentHash, prefsHash: matches.prefsHash, claimedAt: matches.claimedAt })
    .from(matches)
    .where(sql`${matches.userId} = ${userId} and ${matches.jobId} = ${jobId}`);
  return m;
}

const setStatus = (tx: Tx, id: string, status: "scored" | "failed" | "pending") =>
  tx.update(matches).set({ status, error: status === "failed" ? "boom" : null }).where(eq(matches.id, id));

afterAll(async () => {
  await endPool();
});

describe.skipIf(!hasDb)("scoring claim over cycles", () => {
  beforeAll(async () => {
    try {
      await dbPool().execute(sql`select 1`);
    } catch (e) {
      throw new Error(`DATABASE_URL is set but the database cannot be reached: ${e instanceof Error ? e.message : String(e)}`);
    }
  });

  it("claims only fresh jobs that pass the filter and are visible; the backlog is never claimed", async () => {
    await withFixtures(
      [
        { name: "fresh-a" },
        { name: "fresh-b" },
        { name: "backlog", daysAgo: 3 },
        { name: "fresh-fr", locations: FR },
        { name: "fresh-pending", detailPending: true },
        { name: "fresh-swiped" },
      ],
      async (tx, ids, keys) => {
        await tx.insert(swipeDecisions).values({ userId: keys.userId, jobId: ids["fresh-swiped"], decision: "skip" });
        const first = await claimMatches(tx, keys, 20);
        expect(first.map((c) => c.jobId).sort()).toEqual([ids["fresh-a"], ids["fresh-b"]].sort());
        expect(first.every((c) => c.via === "new" && c.attempts === 1)).toBe(true);
        const m = await matchOf(tx, keys.userId, ids["fresh-a"]);
        expect(m.status).toBe("pending");
        expect(m.contentHash).toBe("hash-fresh-a");
        expect(m.prefsHash).toBe("prefs-1");
        // Nothing new and nothing to rework: the second claim is empty, and the backlog is still untouched.
        expect(await claimMatches(tx, keys, 20)).toEqual([]);
        expect(await matchOf(tx, keys.userId, ids.backlog)).toBeUndefined();
      },
    );
  });

  it("retries a failed pair up to three attempts, then leaves it alone", async () => {
    await withFixtures([{ name: "a" }], async (tx, ids, keys) => {
      const [c] = await claimMatches(tx, keys, 5);
      for (let attempt = 2; attempt <= MAX_ATTEMPTS; attempt += 1) {
        await setStatus(tx, c.id, "failed");
        const again = await claimMatches(tx, keys, 5);
        expect(again).toHaveLength(1);
        expect(again[0].via).toBe("rework");
        expect(again[0].attempts).toBe(attempt);
        expect((await matchOf(tx, keys.userId, ids.a)).status).toBe("pending");
      }
      await setStatus(tx, c.id, "failed");
      expect(await claimMatches(tx, keys, 5)).toEqual([]);
      const m = await matchOf(tx, keys.userId, ids.a);
      expect(m.status).toBe("failed");
      expect(m.attempts).toBe(MAX_ATTEMPTS);
    });
  });

  it("reworks a scored pair when the job's content, the prefs or the facts move, and starts attempts again at 1", async () => {
    await withFixtures([{ name: "a" }], async (tx, ids, keys) => {
      const [c] = await claimMatches(tx, keys, 5);
      await tx.update(matches).set({ status: "scored", attempts: 2, score: 70 }).where(eq(matches.id, c.id));
      expect(await claimMatches(tx, keys, 5)).toEqual([]);

      await tx.update(jobs).set({ contentHash: "hash-a-v2" }).where(eq(jobs.id, ids.a));
      const byContent = await claimMatches(tx, keys, 5);
      expect(byContent).toHaveLength(1);
      expect(byContent[0].via).toBe("rework");
      expect(byContent[0].attempts).toBe(1);
      expect((await matchOf(tx, keys.userId, ids.a)).contentHash).toBe("hash-a-v2");

      await setStatus(tx, c.id, "scored");
      const byPrefs = await claimMatches(tx, { ...keys, prefsHash: "prefs-2" }, 5);
      expect(byPrefs).toHaveLength(1);
      expect((await matchOf(tx, keys.userId, ids.a)).prefsHash).toBe("prefs-2");

      await setStatus(tx, c.id, "scored");
      expect(await claimMatches(tx, { ...keys, prefsHash: "prefs-2", factsHash: "facts-2" }, 5)).toHaveLength(1);
      // Current on every hash: nothing to do.
      await setStatus(tx, c.id, "scored");
      expect(await claimMatches(tx, { ...keys, prefsHash: "prefs-2", factsHash: "facts-2" }, 5)).toEqual([]);
    });
  });

  it("treats a pending claim older than the ceiling as a failed attempt, and a closed job is never reworked", async () => {
    await withFixtures([{ name: "a" }, { name: "b" }], async (tx, ids, keys) => {
      const first = await claimMatches(tx, keys, 5);
      expect(first).toHaveLength(2);
      // A fresh pending claim is in flight and is left alone.
      expect(await claimMatches(tx, keys, 5)).toEqual([]);
      const stale = new Date(Date.now() - 20 * 60_000);
      await tx.update(matches).set({ claimedAt: stale }).where(sql`${matches.userId} = ${keys.userId}`);
      await tx.update(jobs).set({ closedAt: new Date() }).where(eq(jobs.id, ids.b));
      const again = await claimMatches(tx, keys, 5);
      expect(again.map((c) => c.jobId)).toEqual([ids.a]);
      expect(again[0].attempts).toBe(2);
      expect((await matchOf(tx, keys.userId, ids.b)).status).toBe("pending");
    });
  });

  it("fills one batch from new pairs first, then rework", async () => {
    await withFixtures([{ name: "a" }], async (tx, ids, keys) => {
      const [c] = await claimMatches(tx, keys, 5);
      await setStatus(tx, c.id, "failed");
      const [src] = await tx.select({ sourceId: jobs.sourceId }).from(jobs).where(eq(jobs.id, ids.a));
      const more = await insertJobs(tx, src.sourceId, [{ name: "b" }]);
      const one = await claimMatches(tx, keys, 1);
      expect(one.map((c) => [c.jobId, c.via])).toEqual([[more.b, "new"]]);
      const two = await claimMatches(tx, keys, 1);
      expect(two.map((c) => [c.jobId, c.via])).toEqual([[ids.a, "rework"]]);
      expect(await claimMatches(tx, keys, 1)).toEqual([]);
    });
  });
});

describe.skipIf(!hasDb)("overlapping scoring claims", () => {
  it("two claims at once split the rows and never hand out the same pair", async () => {
    const db = dbPool();
    const stamp = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const [user] = await db
      .insert(users)
      .values({ name: "Claim fixture", email: `claim-${stamp}@test.invalid`, jobluvoAddress: `claim-${stamp}@test.invalid` })
      .returning({ id: users.id });
    const [src] = await db
      .insert(sources)
      .values({ family: "greenhouse", tenant: `claim-race-${stamp}`, companyName: "Fixture Co", companyDomain: null })
      .returning({ id: sources.id });
    try {
      await db.transaction((tx) => insertJobs(tx, src.id, [{ name: "a" }, { name: "b" }, { name: "c" }, { name: "d" }]));
      const keys: ClaimKeys = { userId: user.id, facts: FACTS, prefsHash: "p", factsHash: "f" };
      const [x, y] = await Promise.all([claimMatches(db, keys, 2), claimMatches(db, keys, 2)]);
      const got = [...x, ...y].map((c) => c.jobId);
      expect(got).toHaveLength(4);
      expect(new Set(got).size).toBe(4);
      // Both failed at once, reworked at once: still disjoint.
      await db.update(matches).set({ status: "failed" }).where(eq(matches.userId, user.id));
      const [p, q] = await Promise.all([claimMatches(db, keys, 2), claimMatches(db, keys, 2)]);
      const re = [...p, ...q].map((c) => c.jobId);
      expect(re).toHaveLength(4);
      expect(new Set(re).size).toBe(4);
      expect([...p, ...q].every((c) => c.via === "rework" && c.attempts === 2)).toBe(true);
    } finally {
      await db.delete(users).where(eq(users.id, user.id));
      await db.delete(sources).where(eq(sources.id, src.id));
    }
  });
});
