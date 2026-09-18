import { and, eq, sql } from "drizzle-orm";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { dbPool, endPool, type DbPool, type Tx } from "@/db/client";
import { jobs, sources, users, type Source } from "@/db/schema";
import { applyPostings, claimBatch, ingestSource, knownJobs } from "./ingest";
import { smartrecruiters } from "./smartrecruiters";
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
  await endPool();
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

/*
 * The whole ingest, adapter included, over successive polls of one
 * SmartRecruiters board. The list is served from a stub that honours
 * If-None-Match exactly as the API does: a 304 whenever the etag it is
 * handed matches the list it is serving. This is the ingest half of the
 * drain guarantee: a body that the budget withheld on one poll arrives on
 * the next, even though the list has not changed since and the API would
 * answer a conditional request with a 304.
 */
describe.skipIf(!hasDb)("ingest over successive polls with the budget exhausted", () => {
  afterEach(() => vi.unstubAllGlobals());

  type Item = { id: string; name: string };
  type Board = { items: Item[]; etag: string; details: Record<string, string> };
  function body(id: string, text: string) {
    return { id, name: text, jobAd: { sections: { jobDescription: { title: "Role", text: `<p>${`${text} owns the ledger and the reconciliation of every payment. `.repeat(3)}</p>` } } } };
  }

  /** The board the first poll finds: two postings, list etag v1. */
  function boardV1(): Board {
    return { items: [{ id: "a", name: "A" }, { id: "b", name: "B" }], etag: '"v1"', details: { a: "A", b: "B" } };
  }

  /** A is renamed on the board, so the list is new and a conditional request is answered in full. */
  function renameA(state: Board) {
    state.items = [{ id: "a", name: "A renamed" }, { id: "b", name: "B" }];
    state.etag = '"v2"';
    state.details.a = "A renamed";
  }

  /** One list with one etag; the etag changes when the list does. Records every request. */
  function stubBoard(state: Board) {
    const listHeaders: (string | null)[] = [];
    const detailUrls: string[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string, init?: RequestInit) => {
        if (url.includes("/postings?")) {
          const sent = new Headers(init?.headers).get("if-none-match");
          listHeaders.push(sent);
          if (sent === state.etag) return new Response(null, { status: 304 });
          return Response.json({ totalFound: state.items.length, content: state.items }, { headers: { etag: state.etag } });
        }
        const id = url.slice(url.lastIndexOf("/") + 1);
        detailUrls.push(id);
        return Response.json(body(id, state.details[id]));
      }),
    );
    return { listHeaders, detailUrls };
  }

  async function reread(tx: Tx, id: string): Promise<Source> {
    const [s] = await tx.select().from(sources).where(eq(sources.id, id));
    return s;
  }

  async function byNative(tx: Tx, sourceId: string) {
    const rows = await tx
      .select({ nativeId: jobs.nativeId, title: jobs.title, descriptionText: jobs.descriptionText, detailPending: jobs.detailPending, listHash: jobs.listHash })
      .from(jobs)
      .where(eq(jobs.sourceId, sourceId));
    return Object.fromEntries(rows.map((r) => [r.nativeId, r]));
  }

  /*
   * The four polls below were one test making thirteen sequential steps
   * against a remote database, each of them several queries. It ran 9.8
   * seconds alone and timed out at 30 seconds inside the full suite often
   * enough to stop a branch going green on its first run. The shape was the
   * problem and the timeout was not, which is the same call made on
   * confirm.test.ts and on the check chain (review five).
   *
   * One test per poll now, each named for what that poll proves. Polls 1 and
   * 2 run through ingestSource. Polls 3 and 4 start from the state the
   * earlier polls leave, set here rather than replayed, which is what keeps
   * them short; the assertions in the first two are what say that state is
   * the real one.
   */

  /**
   * The state a completed poll leaves, reached through the adapter and the
   * upsert but without the claim, the employer lock and the source
   * bookkeeping ingestSource also does. The stub sees the same list request a
   * real poll would make, so the list hashes stored here are the adapter's
   * own and the next poll reads them exactly as it would after a full poll.
   */
  async function seedPoll(tx: Tx, source: Source, detailBudget: number): Promise<Source> {
    const known = await knownJobs(tx, source.id);
    const result = await smartrecruiters.fetch(source, {
      detailBudget,
      known: new Map([...known].map(([k, v]) => [k, { listHash: v.listHash, detailPending: v.detailPending, hasBody: v.hasBody }])),
    });
    if (result.notModified) throw new Error("the seed expected a full list, not a 304");
    await applyPostings(tx, source, result.postings, known);
    const [s] = await tx.update(sources).set({ etag: result.etag ?? source.etag }).where(eq(sources.id, source.id)).returning();
    return s;
  }

  it("a first poll sends no etag, fetches every body, and stores the list etag", async () => {
    await withSource(async (tx, source) => {
      const db = tx as unknown as DbPool;
      const calls = stubBoard(boardV1());

      // Poll 1: nothing known, both bodies fetched, the etag stored.
      const p1 = await ingestSource(db, source, { detailBudget: 40 });
      expect(p1.status).toBe("ok");
      expect(p1.inserted).toBe(2);
      expect(calls.listHeaders).toEqual([null]);
      expect(calls.detailUrls).toEqual(["a", "b"]);
      const rows = await byNative(tx, source.id);
      expect(rows.a.descriptionText).toContain("A owns the ledger");
      expect(rows.b.descriptionText).toContain("B owns the ledger");
      const src = await reread(tx, source.id);
      expect(src.etag).toBe('"v1"');
      expect(src.lastStatus).toBe("ok");
    });
  });

  it("a changed listing the budget cannot refetch keeps its stored body, is marked pending, and the new etag is stored", async () => {
    await withSource(async (tx, source) => {
      const db = tx as unknown as DbPool;
      const state = boardV1();
      const calls = stubBoard(state);
      const seeded = await seedPoll(tx, source, 40);

      // Poll 2: A changed on the board, so the list is new and the conditional
      // request is answered in full. The budget is exhausted before A's body.
      renameA(state);
      const p2 = await ingestSource(db, seeded, { detailBudget: 0 });
      expect(p2.status).toBe("ok");
      expect(p2.detailPending).toBe(1);
      expect(calls.listHeaders).toEqual([null, '"v1"']);
      expect(calls.detailUrls).toEqual(["a", "b"]);
      const rows = await byNative(tx, source.id);
      expect(rows.a.detailPending).toBe(true);
      expect(rows.a.descriptionText).toContain("A owns the ledger");
      expect(rows.b.detailPending).toBe(false);
      const src = await reread(tx, source.id);
      expect(src.etag).toBe('"v2"');
    });
  });

  it("a pending row makes the next poll skip the etag, so a body the budget withheld arrives although the list would answer 304", async () => {
    await withSource(async (tx, source) => {
      const db = tx as unknown as DbPool;
      const state = boardV1();
      const calls = stubBoard(state);
      await seedPoll(tx, source, 40);
      // What poll 2 leaves, asserted in the test above: A renamed on the board,
      // A's row still carrying the old body and marked pending, the new etag stored.
      renameA(state);
      await tx.update(jobs).set({ detailPending: true }).where(and(eq(jobs.sourceId, source.id), eq(jobs.nativeId, "a")));
      const [pending] = await tx.update(sources).set({ etag: '"v2"' }).where(eq(sources.id, source.id)).returning();

      // Poll 3: the list is unchanged since v2, so a conditional request would
      // get a 304 and A would stay pending. The pending row makes the adapter
      // skip the etag, the list comes back in full, and only A's body is fetched.
      const p3 = await ingestSource(db, pending, { detailBudget: 40 });
      expect(p3.status).toBe("ok");
      expect(p3.detailPending).toBe(0);
      // The first entry is the seed's own list request. The second is poll 3,
      // which carried no etag although the source row holds one.
      expect(calls.listHeaders).toEqual([null, null]);
      expect(calls.detailUrls).toEqual(["a", "b", "a"]);
      const rows = await byNative(tx, source.id);
      expect(rows.a.detailPending).toBe(false);
      expect(rows.a.title).toBe("A renamed");
      expect(rows.a.descriptionText).toContain("A renamed owns the ledger");
      expect(rows.b.descriptionText).toContain("B owns the ledger");
      const src = await reread(tx, source.id);
      expect(src.etag).toBe('"v2"');
    });
  });

  it("with nothing pending the etag goes out again, the 304 is honoured, and no body is refetched", async () => {
    await withSource(async (tx, source) => {
      const db = tx as unknown as DbPool;
      const state = boardV1();
      renameA(state);
      const calls = stubBoard(state);
      // What poll 3 leaves: every body stored at the current list, nothing pending, etag v2.
      const drained = await seedPoll(tx, source, 40);
      expect(drained.etag).toBe('"v2"');
      expect((await byNative(tx, source.id)).a.detailPending).toBe(false);

      // Poll 4: nothing pending, the etag goes out again and the 304 is honoured.
      const p4 = await ingestSource(db, drained, { detailBudget: 40 });
      expect(p4.status).toBe("not_modified");
      expect(calls.listHeaders).toEqual([null, '"v2"']);
      expect(calls.detailUrls).toEqual(["a", "b"]);
      const rows = await byNative(tx, source.id);
      expect(rows.a.detailPending).toBe(false);
      expect(rows.a.descriptionText).toContain("A renamed owns the ledger");
    });
  });
});

/*
 * A boilerplate recompute changes content_hash without changing content.
 * The matches of every job whose text did not change must get the new hash
 * copied over, whether the job was listed in the poll (rewritten by the
 * upsert) or not (rehashed in refreshBoilerplate), and a job whose text
 * really changed must keep its stale match so the rework claim finds it.
 */
describe.skipIf(!hasDb)("boilerplate recompute and the matches hash", () => {
  const P = "<p>Acme builds telematics for commercial fleets in forty countries from offices in Istanbul, Berlin and Austin, and works three days a week on site.</p>";
  const body = (own: string, withP: boolean) =>
    `<p>${`${own} owns the ledger and the reconciliation of every payment in the region. `.repeat(3)}</p>${withP ? P : ""}`;

  async function hashes(tx: Tx, sourceId: string, userId: string) {
    const rows = await tx.execute<{ native_id: string; job_hash: string; match_hash: string }>(sql`
      select j.native_id, j.content_hash as job_hash, m.content_hash as match_hash
      from jobs j join matches m on m.job_id = j.id and m.user_id = ${userId}
      where j.source_id = ${sourceId} order by j.native_id
    `);
    return Object.fromEntries(rows.rows.map((r) => [r.native_id, r.match_hash === r.job_hash ? "current" : "stale"]));
  }

  it("copies the new hash for unchanged text, listed or not, and leaves a real change stale", async () => {
    await withSource(async (tx, source) => {
      const [user] = await tx
        .insert(users)
        .values({ name: "Fixture", email: `bp-${Date.now()}@test.invalid`, jobluvoAddress: `bp-${Date.now()}@test.invalid` })
        .returning({ id: users.id });
      const p = (id: string, html: string) => posting({ nativeId: id, title: `Role ${id}`, descriptionHtml: html, applyUrl: `https://jobs.smartrecruiters.com/acme/${id}` });

      // Poll 1: A, B and D share P, so it is boilerplate from the start (3 of 4 on the board).
      await applyPostings(tx, source, [p("a", body("Alpha", true)), p("b", body("Beta", true)), p("c", body("Gamma", false)), p("d", body("Delta", true))], await knownJobs(tx, source.id));
      let [src] = await tx.select().from(sources).where(eq(sources.id, source.id));
      expect(src.boilerplateVersion).toBe(1);
      await tx.execute(sql`
        insert into matches (user_id, job_id, status, prefs_hash, facts_hash, content_hash, score)
        select ${user.id}, id, 'scored', 'p', 'f', content_hash, 70 from jobs where source_id = ${source.id}
      `);
      expect(await hashes(tx, source.id, user.id)).toEqual({ a: "current", b: "current", c: "current", d: "current" });

      // Poll 2: A rewrites its own text and drops P, D is not listed. P is now shared by B and D only,
      // below the threshold, so it stops being boilerplate: B's and D's cores grow without
      // their text changing, A's text changed, C is untouched.
      const known = await knownJobs(tx, source.id);
      await applyPostings(tx, src, [p("a", body("Alpha revised", false)), p("b", body("Beta", true)), p("c", body("Gamma", false))], known);
      [src] = await tx.select().from(sources).where(eq(sources.id, source.id));
      expect(src.boilerplateVersion).toBe(2);
      const after = await tx.select({ nativeId: jobs.nativeId, contentHash: jobs.contentHash }).from(jobs).where(eq(jobs.sourceId, source.id));
      const moved = new Set(after.filter((r) => r.contentHash !== known.get(r.nativeId)!.contentHash).map((r) => r.nativeId));
      expect(moved).toEqual(new Set(["a", "b", "d"]));
      expect(await hashes(tx, source.id, user.id)).toEqual({ a: "stale", b: "current", c: "current", d: "current" });
    });
  });
});
