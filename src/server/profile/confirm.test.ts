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
});
