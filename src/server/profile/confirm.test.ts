import { and, eq, sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { dbPool, type Tx } from "@/db/client";
import { profileDocuments, profileFacts, users } from "@/db/schema";
import { resumeFacts } from "@/server/match/profile";
import { filterFacts } from "@/server/profile/viewer";
import { decideFacts, profileView, replaceWithDocument } from "./confirm";

/*
 * Confirmation over its cycle against the real database, inside one rolled
 * back transaction: extracted facts are invisible to the readers until
 * confirmed, single decisions move one fact, and replacing with a document
 * confirms its facts and retires the ones before it while the user's own
 * answers stay. Skipped without DATABASE_URL.
 */

const hasDb = !!process.env.DATABASE_URL;

class Rollback extends Error {}

async function withUser(fn: (tx: Tx, userId: string) => Promise<void>) {
  await dbPool()
    .transaction(async (tx) => {
      const stamp = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const [user] = await tx
        .insert(users)
        .values({ name: "Confirm fixture", email: `confirm-${stamp}@test.invalid`, jobluvoAddress: `confirm-${stamp}@test.invalid` })
        .returning({ id: users.id });
      await fn(tx, user.id);
      throw new Rollback();
    })
    .catch((e) => {
      if (!(e instanceof Rollback)) throw e;
    });
}

const seedFacts = (userId: string) => [
  { userId, kind: "preference" as const, origin: "user" as const, status: "confirmed" as const, data: { targetCountries: ["US"], relocation: "yes", remote: "remote_ok" } },
  { userId, kind: "employment" as const, origin: "user" as const, status: "confirmed" as const, data: { company: "Old Co", title: "Analyst", start: "2016-09", bullets: ["Old line."] } },
  { userId, kind: "skill" as const, origin: "user" as const, status: "confirmed" as const, data: { name: "Old skill" } },
];

afterAll(async () => {
  const g = globalThis as unknown as { __jobluvoPool?: { end(): Promise<void> } };
  await g.__jobluvoPool?.end();
});

describe.skipIf(!hasDb)("confirmation over its cycle", () => {
  beforeAll(async () => {
    try {
      await dbPool().execute(sql`select 1`);
    } catch (e) {
      throw new Error(`DATABASE_URL is set but the database cannot be reached: ${e instanceof Error ? e.message : String(e)}`);
    }
  });

  it("extracted facts are not read until confirmed; a single confirm and reject move one fact each", async () => {
    await withUser(async (tx, userId) => {
      await tx.insert(profileFacts).values(seedFacts(userId));
      const [doc] = await tx.insert(profileDocuments).values({ userId, filename: "resume.pdf", bytesPhase0: Buffer.from("%PDF"), text: "" }).returning({ id: profileDocuments.id });
      const rows = await tx
        .insert(profileFacts)
        .values([
          { userId, documentId: doc.id, kind: "employment", origin: "upload", status: "extracted", evidence: "Head of Strategy", data: { company: "New Co", title: "Head of Strategy", start: "2022-03", bullets: ["New line."] } },
          { userId, documentId: doc.id, kind: "skill", origin: "upload", status: "extracted", evidence: "SQL", data: { name: "SQL" } },
        ])
        .returning({ id: profileFacts.id, kind: profileFacts.kind });
      const before = (await resumeFacts(tx, userId))!;
      expect(before.employment.map((e) => e.company)).toEqual(["Old Co"]);
      expect(before.skills.map((s) => s.name)).toEqual(["Old skill"]);

      const view = await profileView(tx, userId);
      expect(view.documents).toEqual([expect.objectContaining({ filename: "resume.pdf", extracted: 2, confirmed: 0 })]);

      const emp = rows.find((r) => r.kind === "employment")!.id;
      const skill = rows.find((r) => r.kind === "skill")!.id;
      expect(await decideFacts(tx, userId, { confirm: [emp], reject: [skill] })).toEqual({ confirmed: 1, rejected: 1 });
      const after = (await resumeFacts(tx, userId))!;
      expect(after.employment.map((e) => e.company).sort()).toEqual(["New Co", "Old Co"]);
      expect(after.skills.map((s) => s.name)).toEqual(["Old skill"]);
      expect(after.factsHash).not.toBe(before.factsHash);
      // Another user's ids are ignored.
      expect(await decideFacts(tx, "00000000-0000-0000-0000-000000000000", { confirm: [emp] })).toEqual({ confirmed: 0, rejected: 0 });
    });
  });

  it("replacing with a document confirms its facts, retires the resume facts before it, and leaves the user's own answers alone", async () => {
    await withUser(async (tx, userId) => {
      await tx.insert(profileFacts).values(seedFacts(userId));
      const [doc] = await tx.insert(profileDocuments).values({ userId, filename: "resume.pdf", bytesPhase0: Buffer.from("%PDF"), text: "" }).returning({ id: profileDocuments.id });
      await tx.insert(profileFacts).values([
        { userId, documentId: doc.id, kind: "employment", origin: "upload", status: "extracted", evidence: "x", data: { company: "New Co", title: "Head of Strategy", start: "2022-03", bullets: ["New line."] } },
        { userId, documentId: doc.id, kind: "education", origin: "upload", status: "extracted", evidence: "x", data: { institution: "Koc University", degree: "MBA" } },
        { userId, documentId: doc.id, kind: "contact", origin: "upload", status: "extracted", evidence: "x", data: { name: "Jack" } },
      ]);
      expect(await replaceWithDocument(tx, userId, doc.id)).toEqual({ confirmed: 3, retired: 2 });
      const f = (await resumeFacts(tx, userId))!;
      expect(f.employment.map((e) => e.company)).toEqual(["New Co"]);
      expect(f.education.map((e) => e.institution)).toEqual(["Koc University"]);
      expect(f.skills).toEqual([]);
      // The preference fact is untouched: the hard filter still has its facts.
      expect((await filterFacts(userId, tx))?.prefs.targetCountries).toEqual(["US"]);
      // Retired facts are kept as rejected, not deleted.
      const old = await tx.select({ status: profileFacts.status }).from(profileFacts).where(and(eq(profileFacts.userId, userId), eq(profileFacts.origin, "user"), eq(profileFacts.kind, "employment")));
      expect(old).toEqual([{ status: "rejected" }]);
      // Doing it again changes nothing.
      expect(await replaceWithDocument(tx, userId, doc.id)).toEqual({ confirmed: 0, retired: 0 });
      await expect(replaceWithDocument(tx, userId, "00000000-0000-0000-0000-000000000000")).rejects.toThrow(/document not found/);
    });
  });

  it("a failure between the retirement and the confirmation rolls the retirement back", async () => {
    await withUser(async (tx, userId) => {
      await tx.insert(profileFacts).values(seedFacts(userId));
      const [doc] = await tx.insert(profileDocuments).values({ userId, filename: "resume.pdf", bytesPhase0: Buffer.from("%PDF"), text: "" }).returning({ id: profileDocuments.id });
      await tx.insert(profileFacts).values([{ userId, documentId: doc.id, kind: "employment", origin: "upload", status: "extracted", evidence: "x", data: { company: "New Co", title: "Head", start: "2022-03", bullets: ["New line."] } }]);
      // The replacement's second update, the confirmation, fails. The first, the retirement, has already run inside the same transaction.
      await expect(replaceWithDocument(failingOn(tx, 2), userId, doc.id)).rejects.toThrow(/injected failure/);
      const f = (await resumeFacts(tx, userId))!;
      expect(f.employment.map((e) => e.company)).toEqual(["Old Co"]);
      expect(f.skills.map((s) => s.name)).toEqual(["Old skill"]);
      const status = await tx.select({ status: profileFacts.status }).from(profileFacts).where(and(eq(profileFacts.userId, userId), eq(profileFacts.documentId, doc.id)));
      expect(status).toEqual([{ status: "extracted" }]);
      // The transaction is still usable: the replacement runs clean afterwards.
      expect(await replaceWithDocument(tx, userId, doc.id)).toEqual({ confirmed: 1, retired: 2 });
    });
  });

  it("a document with no extracted facts retires nothing", async () => {
    await withUser(async (tx, userId) => {
      await tx.insert(profileFacts).values(seedFacts(userId));
      const [empty] = await tx.insert(profileDocuments).values({ userId, filename: "failed.pdf", bytesPhase0: Buffer.from("%PDF"), text: "" }).returning({ id: profileDocuments.id });
      expect(await replaceWithDocument(tx, userId, empty.id)).toEqual({ confirmed: 0, retired: 0 });
      const f = (await resumeFacts(tx, userId))!;
      expect(f.employment.map((e) => e.company)).toEqual(["Old Co"]);
      expect(f.skills.map((s) => s.name)).toEqual(["Old skill"]);
    });
  });

  it("two replacements for one user at once run one after the other through the pool, and the profile is one document, never a mix", async () => {
    const db = dbPool();
    const stamp = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const [user] = await db
      .insert(users)
      .values({ name: "Confirm race fixture", email: `confirm-race-${stamp}@test.invalid`, jobluvoAddress: `confirm-race-${stamp}@test.invalid` })
      .returning({ id: users.id });
    try {
      await db.insert(profileFacts).values(seedFacts(user.id));
      const [a] = await db.insert(profileDocuments).values({ userId: user.id, filename: "a.pdf", bytesPhase0: Buffer.from("%PDF"), text: "" }).returning({ id: profileDocuments.id });
      const [b] = await db.insert(profileDocuments).values({ userId: user.id, filename: "b.pdf", bytesPhase0: Buffer.from("%PDF"), text: "" }).returning({ id: profileDocuments.id });
      await db.insert(profileFacts).values([
        { userId: user.id, documentId: a.id, kind: "employment", origin: "upload", status: "extracted", evidence: "x", data: { company: "A Co", title: "Head", start: "2022-03", bullets: ["A line."] } },
        { userId: user.id, documentId: a.id, kind: "skill", origin: "upload", status: "extracted", evidence: "x", data: { name: "A skill" } },
        { userId: user.id, documentId: b.id, kind: "employment", origin: "upload", status: "extracted", evidence: "x", data: { company: "B Co", title: "Head", start: "2023-03", bullets: ["B line."] } },
        { userId: user.id, documentId: b.id, kind: "skill", origin: "upload", status: "extracted", evidence: "x", data: { name: "B skill" } },
        { userId: user.id, documentId: b.id, kind: "contact", origin: "upload", status: "extracted", evidence: "x", data: { name: "Jack" } },
      ]);
      const [ra, rb] = await Promise.all([replaceWithDocument(db, user.id, a.id), replaceWithDocument(db, user.id, b.id)]);
      // Each confirmed its own facts; the one that ran second also retired the first's.
      expect(ra.confirmed).toBe(2);
      expect(rb.confirmed).toBe(3);
      const rows = await db
        .select({ documentId: profileFacts.documentId, status: profileFacts.status, origin: profileFacts.origin })
        .from(profileFacts)
        .where(eq(profileFacts.userId, user.id));
      const confirmedDocs = new Set(rows.filter((r) => r.status === "confirmed" && r.origin === "upload").map((r) => r.documentId));
      expect(confirmedDocs.size).toBe(1);
      const winner = [...confirmedDocs][0];
      const loser = winner === a.id ? b.id : a.id;
      // The first retired the 2 seeded resume facts; the second retired the first's own, 2 for a or 3 for b.
      expect(ra.retired + rb.retired).toBe(2 + (winner === b.id ? 2 : 3));
      expect(rows.filter((r) => r.documentId === winner).every((r) => r.status === "confirmed")).toBe(true);
      expect(rows.filter((r) => r.documentId === loser).every((r) => r.status === "rejected")).toBe(true);
      // The user's own resume facts are retired, the preference is untouched.
      expect(rows.filter((r) => r.origin === "user").map((r) => r.status).sort()).toEqual(["confirmed", "rejected", "rejected"]);
      expect((await filterFacts(user.id, db))?.prefs.targetCountries).toEqual(["US"]);
    } finally {
      await db.delete(profileFacts).where(eq(profileFacts.userId, user.id));
      await db.delete(profileDocuments).where(eq(profileDocuments.userId, user.id));
      await db.delete(users).where(eq(users.id, user.id));
    }
  });
});

/**
 * The transaction handle with its nth `update` replaced by a throw, carried
 * into the savepoint the replacement opens, so the failure lands between
 * the two statements of one transaction. No seam in the production code.
 */
function failingOn(tx: Tx, nth: number, state = { n: 0 }): Tx {
  return new Proxy(tx, {
    get(target, key, receiver) {
      if (key === "transaction") {
        const real = Reflect.get(target, key, receiver) as Tx["transaction"];
        return ((cb: (inner: Tx) => Promise<unknown>) => real.call(target, (inner: Tx) => cb(failingOn(inner, nth, state)))) as Tx["transaction"];
      }
      if (key === "update") {
        state.n += 1;
        if (state.n === nth) throw new Error("injected failure");
      }
      return Reflect.get(target, key, receiver);
    },
  });
}
