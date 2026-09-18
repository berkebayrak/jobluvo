import { sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { dbPool, endPool, type Tx } from "@/db/client";
import { jobGroupLinks, jobGroups, jobs, sources, swipeDecisions, users, type JobLocation } from "@/db/schema";
import type { FilterFacts } from "@/server/match/hardFilter";
import { feedForUser } from "./feed";
import { recomputeCanonical } from "./identity";

/*
 * The feed over a cycle, against the real database, inside one transaction
 * that is rolled back at the end. Single calls cannot catch what these are
 * about: a group whose canonical changes between two reads, and a decision
 * taken on one copy of a posting that has to hold for the other copy. Both
 * only appear when the same feed is read twice with something happening in
 * between. Skipped without DATABASE_URL, and a hard failure when
 * DATABASE_URL is set but the database cannot be reached.
 */

const hasDb = !!process.env.DATABASE_URL;

class Rollback extends Error {}

const US_FACTS: FilterFacts = {
  prefs: { targetCountries: ["US"], relocation: "yes", remote: "remote_ok" },
  auth: [],
  sponsorship: null,
};

const NEW_YORK: JobLocation[] = [{ raw: "New York, NY", city: "New York", region: "NY", country: "US" }];
const BERLIN: JobLocation[] = [{ raw: "Berlin, Germany", city: "Berlin", country: "DE" }];

async function withFixture(fn: (tx: Tx, ctx: { userId: string; sourceId: string }) => Promise<void>) {
  await dbPool()
    .transaction(async (tx) => {
      const stamp = Date.now();
      const [user] = await tx
        .insert(users)
        .values({ name: "Jack Miller", email: `feed-test-${stamp}@jobluvo.com`, jobluvoAddress: `feed-test-${stamp}` })
        .returning();
      const [source] = await tx
        .insert(sources)
        .values({ family: "greenhouse", tenant: `feed-test-${stamp}`, companyName: "Datadog", companyDomain: "datadoghq.com" })
        .returning();
      /*
       * The feed reads the whole jobs table, and these tests count cards, so
       * the fixture starts from an empty one. The delete lives inside the
       * transaction and goes away with it; nothing outside this test ever
       * sees it. Do not run the suite against a database that is ingesting at
       * the same time: this holds a lock on jobs until the rollback.
       */
      await tx.execute(sql`delete from jobs`);
      await fn(tx, { userId: user.id, sourceId: source.id });
      throw new Rollback();
    })
    .catch((e) => {
      if (!(e instanceof Rollback)) throw e;
    });
}

let n = 0;
async function job(tx: Tx, sourceId: string, over: { locations: JobLocation[]; firstSeenAt: Date; title?: string }) {
  n += 1;
  const native = `feed-test-${Date.now()}-${n}`;
  const [row] = await tx
    .insert(jobs)
    .values({
      sourceId,
      family: "greenhouse",
      nativeId: native,
      title: over.title ?? "Strategic Account Executive",
      titleNorm: (over.title ?? "Strategic Account Executive").toLowerCase(),
      companyName: "Datadog",
      companyDomain: "datadoghq.com",
      locations: over.locations,
      workplace: "onsite",
      descriptionText: "We are hiring.",
      descriptionCore: "We are hiring.",
      contentHash: `hash-${native}`,
      applyUrl: `https://boards.greenhouse.io/datadog/jobs/${native}`,
      applyUrlNorm: `https://boards.greenhouse.io/datadog/jobs/${native}`,
      firstSeenAt: over.firstSeenAt,
    })
    .returning();
  return row;
}

async function group(tx: Tx, canonicalJobId: string, memberIds: string[]) {
  const [g] = await tx.insert(jobGroups).values({ canonicalJobId }).returning();
  for (const id of memberIds) await tx.insert(jobGroupLinks).values({ groupId: g.id, jobId: id, reason: "native" });
  return g;
}

const ids = async (tx: Tx, userId: string, facts: FilterFacts | null = null) =>
  (await feedForUser(userId, { db: tx, facts })).jobs.map((j) => j.id);

afterAll(async () => {
  await endPool();
});

describe.skipIf(!hasDb)("the feed over a cycle", () => {
  beforeAll(async () => {
    try {
      await dbPool().execute(sql`select 1`);
    } catch (e) {
      throw new Error(`DATABASE_URL is set but the database cannot be reached: ${e instanceof Error ? e.message : String(e)}`);
    }
  });

  it("a canonical change does not resurrect a swiped opportunity", async () => {
    await withFixture(async (tx, { userId, sourceId }) => {
      const older = await job(tx, sourceId, { locations: NEW_YORK, firstSeenAt: new Date("2026-09-01T00:00:00Z") });
      const newer = await job(tx, sourceId, { locations: NEW_YORK, firstSeenAt: new Date("2026-09-02T00:00:00Z") });
      const g = await group(tx, older.id, [older.id, newer.id]);

      // One card for the group, the earlier copy.
      expect(await ids(tx, userId)).toEqual([older.id]);

      // The user skips it. The group leaves the feed.
      await tx.insert(swipeDecisions).values({ userId, jobId: older.id, decision: "skip" });
      expect(await ids(tx, userId)).toEqual([]);

      // The copy that was swiped closes, so the canonical moves to the other copy.
      await tx.execute(sql`update jobs set closed_at = now() where id = ${older.id}`);
      await recomputeCanonical(tx, g.id);
      const [moved] = (await tx.execute<{ canonical_job_id: string }>(
        sql`select canonical_job_id from job_groups where id = ${g.id}`,
      )).rows;
      expect(moved.canonical_job_id).toBe(newer.id);

      // The decision was about the opportunity, so the group stays buried.
      expect(await ids(tx, userId)).toEqual([]);
    });
  });

  it("a swipe on one copy buries the whole group, and Undo brings back exactly one card", async () => {
    await withFixture(async (tx, { userId, sourceId }) => {
      const a = await job(tx, sourceId, { locations: NEW_YORK, firstSeenAt: new Date("2026-09-01T00:00:00Z") });
      const b = await job(tx, sourceId, { locations: NEW_YORK, firstSeenAt: new Date("2026-09-02T00:00:00Z") });
      await group(tx, a.id, [a.id, b.id]);

      // The decision is recorded against the copy that was not the card on screen.
      await tx.insert(swipeDecisions).values({ userId, jobId: b.id, decision: "apply" });
      expect(await ids(tx, userId)).toEqual([]);

      await tx.execute(sql`delete from swipe_decisions where user_id = ${userId} and job_id = ${b.id}`);
      expect(await ids(tx, userId)).toEqual([a.id]);
    });
  });

  it("the group is represented by a member that passes the filter, not by a canonical that fails it", async () => {
    await withFixture(async (tx, { userId, sourceId }) => {
      const canonical = await job(tx, sourceId, { locations: BERLIN, firstSeenAt: new Date("2026-09-01T00:00:00Z") });
      const sibling = await job(tx, sourceId, { locations: NEW_YORK, firstSeenAt: new Date("2026-09-02T00:00:00Z") });
      await group(tx, canonical.id, [canonical.id, sibling.id]);

      const page = await feedForUser(userId, { db: tx, facts: US_FACTS });
      expect(page.jobs.map((j) => j.id)).toEqual([sibling.id]);
      expect(page.inventory.jobs).toBe(1);
      // The group is shown, so it is not also counted as hidden.
      expect(page.hidden.total).toBe(0);
      expect(page.jobs[0].copies).toBe(2);
    });
  });

  it("a group where nothing passes is counted once, not once per copy", async () => {
    await withFixture(async (tx, { userId, sourceId }) => {
      const a = await job(tx, sourceId, { locations: BERLIN, firstSeenAt: new Date("2026-09-01T00:00:00Z") });
      const b = await job(tx, sourceId, { locations: BERLIN, firstSeenAt: new Date("2026-09-02T00:00:00Z") });
      await group(tx, a.id, [a.id, b.id]);

      const page = await feedForUser(userId, { db: tx, facts: US_FACTS });
      expect(page.jobs).toEqual([]);
      expect(page.hidden.total).toBe(1);
      expect(page.hidden.reasons["not in target countries"]).toBe(1);
    });
  });

  it("a job with no group is its own card and counts one copy", async () => {
    await withFixture(async (tx, { userId, sourceId }) => {
      const only = await job(tx, sourceId, { locations: NEW_YORK, firstSeenAt: new Date("2026-09-01T00:00:00Z") });
      const page = await feedForUser(userId, { db: tx, facts: US_FACTS });
      expect(page.jobs.map((j) => j.id)).toEqual([only.id]);
      expect(page.jobs[0].copies).toBe(1);
    });
  });
});
