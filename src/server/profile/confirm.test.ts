import { and, eq, sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { dbPool, type DbPool, type Tx } from "@/db/client";
import { profileDocuments, profileFacts, users } from "@/db/schema";
import { resumeFacts } from "@/server/match/profile";
import { filterFacts } from "@/server/profile/viewer";
import { decideFacts, documentState, editFact, PROCESSING_STALE_MS, profileView, replaceWithDocument } from "./confirm";

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

/** What the page sends: the document's waiting facts as displayed, id and version. */
async function seenOf(tx: DbPool | Tx, userId: string, documentId: string) {
  return tx
    .select({ id: profileFacts.id, version: profileFacts.version })
    .from(profileFacts)
    .where(and(eq(profileFacts.userId, userId), eq(profileFacts.documentId, documentId), eq(profileFacts.status, "extracted")));
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
      const [doc] = await tx.insert(profileDocuments).values({ userId, filename: "resume.pdf", bytesPhase0: Buffer.from("%PDF"), text: "", status: "ready" }).returning({ id: profileDocuments.id });
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
      expect(await decideFacts(tx, userId, { confirm: [{ id: emp, version: 1 }], reject: [{ id: skill, version: 1 }] })).toEqual({ confirmed: 1, rejected: 1, asked: { confirm: 1, reject: 1 }, skipped: [] });
      const after = (await resumeFacts(tx, userId))!;
      expect(after.employment.map((e) => e.company).sort()).toEqual(["New Co", "Old Co"]);
      expect(after.skills.map((s) => s.name)).toEqual(["Old skill"]);
      expect(after.factsHash).not.toBe(before.factsHash);
      // Another user's ids are skipped and named.
      expect(await decideFacts(tx, "00000000-0000-0000-0000-000000000000", { confirm: [{ id: emp, version: 1 }] })).toEqual({ confirmed: 0, rejected: 0, asked: { confirm: 1, reject: 0 }, skipped: [emp] });
      // A second click on the same ids moves nothing and says so.
      expect(await decideFacts(tx, userId, { confirm: [{ id: emp, version: 1 }], reject: [{ id: skill, version: 1 }] })).toEqual({ confirmed: 0, rejected: 0, asked: { confirm: 1, reject: 1 }, skipped: [emp, skill] });
      // A rejected fact is not revived by confirming its id; a confirmed one can still be rejected.
      expect(await decideFacts(tx, userId, { confirm: [{ id: skill, version: 1 }], reject: [{ id: emp, version: 1 }] })).toEqual({ confirmed: 0, rejected: 1, asked: { confirm: 1, reject: 1 }, skipped: [skill] });
      expect((await resumeFacts(tx, userId))!.employment.map((e) => e.company)).toEqual(["Old Co"]);
    });
  });

  it("after a replacement, a stale confirm of the old document's fact id does not put a second document into the confirmed profile", async () => {
    await withUser(async (tx, userId) => {
      await tx.insert(profileFacts).values(seedFacts(userId));
      const [a] = await tx.insert(profileDocuments).values({ userId, filename: "a.pdf", bytesPhase0: Buffer.from("%PDF"), text: "", status: "ready" }).returning({ id: profileDocuments.id });
      const aRows = await tx
        .insert(profileFacts)
        .values([
          { userId, documentId: a.id, kind: "employment", origin: "upload", status: "extracted", evidence: "x", data: { company: "A Co", title: "Head", start: "2022-03", bullets: ["A line."] } },
          { userId, documentId: a.id, kind: "skill", origin: "upload", status: "extracted", evidence: "x", data: { name: "A skill" } },
        ])
        .returning({ id: profileFacts.id });
      expect(await replaceWithDocument(tx, userId, a.id, await seenOf(tx, userId, a.id))).toEqual({ confirmed: 2, retired: 2 });
      // The page that showed document a is still open when the user replaces with document b.
      const [b] = await tx.insert(profileDocuments).values({ userId, filename: "b.pdf", bytesPhase0: Buffer.from("%PDF"), text: "", status: "ready" }).returning({ id: profileDocuments.id });
      await tx.insert(profileFacts).values([
        { userId, documentId: b.id, kind: "employment", origin: "upload", status: "extracted", evidence: "x", data: { company: "B Co", title: "Head", start: "2023-03", bullets: ["B line."] } },
        { userId, documentId: b.id, kind: "contact", origin: "upload", status: "extracted", evidence: "x", data: { name: "Jack" } },
      ]);
      expect(await replaceWithDocument(tx, userId, b.id, await seenOf(tx, userId, b.id))).toEqual({ confirmed: 2, retired: 2 });
      // The stale page posts a's ids.
      const stale = await decideFacts(tx, userId, { confirm: aRows.map((r) => ({ id: r.id, version: 1 })) });
      expect(stale).toEqual({ confirmed: 0, rejected: 0, asked: { confirm: 2, reject: 0 }, skipped: aRows.map((r) => r.id) });
      // The invariant: every confirmed resume fact carries one document id, and it is b's.
      const confirmed = await tx
        .select({ documentId: profileFacts.documentId, kind: profileFacts.kind })
        .from(profileFacts)
        .where(and(eq(profileFacts.userId, userId), eq(profileFacts.status, "confirmed")));
      const resume = confirmed.filter((f) => f.kind !== "preference" && f.kind !== "authorization" && f.kind !== "sponsorship");
      expect(new Set(resume.map((f) => f.documentId))).toEqual(new Set([b.id]));
      expect(resume).toHaveLength(2);
      expect((await resumeFacts(tx, userId))!.employment.map((e) => e.company)).toEqual(["B Co"]);
    });
  });

  it("replacing with a document confirms its facts, retires the resume facts before it, and leaves the user's own answers alone", async () => {
    await withUser(async (tx, userId) => {
      await tx.insert(profileFacts).values(seedFacts(userId));
      const [doc] = await tx.insert(profileDocuments).values({ userId, filename: "resume.pdf", bytesPhase0: Buffer.from("%PDF"), text: "", status: "ready" }).returning({ id: profileDocuments.id });
      await tx.insert(profileFacts).values([
        { userId, documentId: doc.id, kind: "employment", origin: "upload", status: "extracted", evidence: "x", data: { company: "New Co", title: "Head of Strategy", start: "2022-03", bullets: ["New line."] } },
        { userId, documentId: doc.id, kind: "education", origin: "upload", status: "extracted", evidence: "x", data: { institution: "Koc University", degree: "MBA" } },
        { userId, documentId: doc.id, kind: "contact", origin: "upload", status: "extracted", evidence: "x", data: { name: "Jack" } },
      ]);
      expect(await replaceWithDocument(tx, userId, doc.id, await seenOf(tx, userId, doc.id))).toEqual({ confirmed: 3, retired: 2 });
      const f = (await resumeFacts(tx, userId))!;
      expect(f.employment.map((e) => e.company)).toEqual(["New Co"]);
      expect(f.education.map((e) => e.institution)).toEqual(["Koc University"]);
      expect(f.skills).toEqual([]);
      // The preference fact is untouched: the hard filter still has its facts.
      expect((await filterFacts(userId, tx))?.prefs.targetCountries).toEqual(["US"]);
      // Retired facts are kept as rejected, not deleted.
      const old = await tx.select({ status: profileFacts.status }).from(profileFacts).where(and(eq(profileFacts.userId, userId), eq(profileFacts.origin, "user"), eq(profileFacts.kind, "employment")));
      expect(old).toEqual([{ status: "rejected" }]);
      // Doing it again changes nothing and says why.
      await expect(replaceWithDocument(tx, userId, doc.id, await seenOf(tx, userId, doc.id))).rejects.toMatchObject({ reason: "nothing_to_confirm", message: "nothing left to confirm from resume.pdf" });
      await expect(replaceWithDocument(tx, userId, "00000000-0000-0000-0000-000000000000", [])).rejects.toMatchObject({ reason: "not_found" });
      expect((await resumeFacts(tx, userId))!.employment.map((e) => e.company)).toEqual(["New Co"]);
    });
  });

  it("a document still being read, one that failed, or one the function died on is refused before anything is retired", async () => {
    await withUser(async (tx, userId) => {
      await tx.insert(profileFacts).values(seedFacts(userId));
      const [reading] = await tx.insert(profileDocuments).values({ userId, filename: "reading.pdf", bytesPhase0: Buffer.from("%PDF"), text: "", status: "processing" }).returning({ id: profileDocuments.id });
      const [failed] = await tx
        .insert(profileDocuments)
        .values({ userId, filename: "failed.pdf", bytesPhase0: Buffer.from("%PDF"), text: "", status: "failed", error: "response incomplete: max_output_tokens" })
        .returning({ id: profileDocuments.id });
      const [died] = await tx
        .insert(profileDocuments)
        .values({ userId, filename: "died.pdf", bytesPhase0: Buffer.from("%PDF"), text: "", status: "processing", uploadedAt: new Date(Date.now() - PROCESSING_STALE_MS - 1000) })
        .returning({ id: profileDocuments.id });
      // Even with facts attached, a processing or failed document cannot replace the profile.
      await tx.insert(profileFacts).values([{ userId, documentId: reading.id, kind: "skill", origin: "upload", status: "extracted", evidence: "x", data: { name: "Half read" } }]);
      await expect(replaceWithDocument(tx, userId, reading.id, await seenOf(tx, userId, reading.id))).rejects.toMatchObject({ reason: "processing", message: "reading.pdf is still being read" });
      await expect(replaceWithDocument(tx, userId, failed.id, await seenOf(tx, userId, failed.id))).rejects.toMatchObject({ reason: "failed" });
      await expect(replaceWithDocument(tx, userId, died.id, await seenOf(tx, userId, died.id))).rejects.toMatchObject({ reason: "failed" });
      const f = (await resumeFacts(tx, userId))!;
      expect(f.employment.map((e) => e.company)).toEqual(["Old Co"]);
      expect(f.skills.map((s) => s.name)).toEqual(["Old skill"]);
      // The view says each state in its own word, never "verified" for a document with no confirmed facts.
      const view = await profileView(tx, userId);
      const state = (id: string) => view.documents.find((d) => d.id === id)!.state;
      expect(state(reading.id)).toBe("processing");
      expect(state(failed.id)).toBe("failed");
      expect(state(died.id)).toBe("failed");
      expect(view.documents.find((d) => d.id === failed.id)!.error).toBe("response incomplete: max_output_tokens");
    });
  });

  it("with two documents waiting, confirming the older one explicitly confirms only that one and leaves the newer waiting", async () => {
    await withUser(async (tx, userId) => {
      await tx.insert(profileFacts).values(seedFacts(userId));
      const [older] = await tx
        .insert(profileDocuments)
        .values({ userId, filename: "older.pdf", bytesPhase0: Buffer.from("%PDF"), text: "", status: "ready", uploadedAt: new Date(Date.now() - 60_000) })
        .returning({ id: profileDocuments.id });
      const [newer] = await tx.insert(profileDocuments).values({ userId, filename: "newer.pdf", bytesPhase0: Buffer.from("%PDF"), text: "", status: "ready" }).returning({ id: profileDocuments.id });
      await tx.insert(profileFacts).values([
        { userId, documentId: older.id, kind: "employment", origin: "upload", status: "extracted", evidence: "x", data: { company: "Older Co", title: "Head", start: "2022-03", bullets: ["Older line."] } },
        { userId, documentId: newer.id, kind: "employment", origin: "upload", status: "extracted", evidence: "x", data: { company: "Newer Co", title: "Head", start: "2023-03", bullets: ["Newer line."] } },
        { userId, documentId: newer.id, kind: "skill", origin: "upload", status: "extracted", evidence: "x", data: { name: "Newer skill" } },
      ]);
      const view = await profileView(tx, userId);
      expect(view.documents.map((d) => [d.filename, d.state, d.extracted])).toEqual([
        ["newer.pdf", "check", 2],
        ["older.pdf", "check", 1],
      ]);
      expect(await replaceWithDocument(tx, userId, older.id, await seenOf(tx, userId, older.id))).toEqual({ confirmed: 1, retired: 2 });
      const f = (await resumeFacts(tx, userId))!;
      expect(f.employment.map((e) => e.company)).toEqual(["Older Co"]);
      const after = await profileView(tx, userId);
      expect(after.documents.map((d) => [d.filename, d.state, d.extracted, d.confirmed])).toEqual([
        ["newer.pdf", "check", 2, 0],
        ["older.pdf", "verified", 0, 1],
      ]);
    });
  });

  it("an edit of a waiting fact moves its version and keeps it waiting; a decision or a replacement bound to the old version is refused", async () => {
    await withUser(async (tx, userId) => {
      await tx.insert(profileFacts).values(seedFacts(userId));
      const [doc] = await tx.insert(profileDocuments).values({ userId, filename: "resume.pdf", bytesPhase0: Buffer.from("%PDF"), text: "", status: "ready" }).returning({ id: profileDocuments.id });
      const [emp, skill] = await tx
        .insert(profileFacts)
        .values([
          {
            userId,
            documentId: doc.id,
            kind: "employment",
            origin: "upload",
            status: "extracted",
            evidence: "Head of Strategy, New Co",
            data: { company: "New Co", title: "Head of Strategy", start: "2022-03", bullets: ["Cut cost 11 percent.", "Ran the planning cycle."] },
          },
          { userId, documentId: doc.id, kind: "skill", origin: "upload", status: "extracted", evidence: "SQL", data: { name: "SQL" } },
        ])
        .returning({ id: profileFacts.id, version: profileFacts.version });
      expect([emp.version, skill.version]).toEqual([1, 1]);
      // The user fixes the second bullet, at the version the page showed.
      const edited = await editFact(tx, userId, { id: emp.id, version: 1, data: { company: "New Co", title: "Head of Strategy", start: "2022-03", bullets: ["Cut cost 11 percent.", "Ran the annual planning cycle."] } });
      expect(edited.version).toBe(2);
      const [row] = await tx.select().from(profileFacts).where(eq(profileFacts.id, emp.id));
      expect(row).toMatchObject({ status: "extracted", origin: "edit", version: 2, evidence: "Head of Strategy, New Co" });
      expect((row.data as { bullets: string[] }).bullets[1]).toBe("Ran the annual planning cycle.");
      // The same edit again, at the old version, is refused; so is one the schema refuses; so is one on a confirmed fact.
      await expect(editFact(tx, userId, { id: emp.id, version: 1, data: row.data as Record<string, unknown> })).rejects.toMatchObject({ reason: "changed" });
      await expect(editFact(tx, userId, { id: emp.id, version: 2, data: { company: "New Co", title: "Head", start: "March 2022", bullets: [] } })).rejects.toMatchObject({ reason: "invalid", message: expect.stringContaining("start") });
      await expect(editFact(tx, userId, { id: "00000000-0000-0000-0000-000000000000", version: 1, data: {} })).rejects.toMatchObject({ reason: "not_found" });
      // A skill edit that does not mention the evidence keeps it; one that names it changes it; contact, link and project edits have a schema.
      const [skillRow] = await tx
        .update(profileFacts)
        .set({ data: { name: "SQL", years: 6, evidence: "Pricing dashboards in SQL" } })
        .where(eq(profileFacts.id, skill.id))
        .returning({ version: profileFacts.version });
      const kept = await editFact(tx, userId, { id: skill.id, version: skillRow.version, data: { name: "SQL", years: 7 } });
      expect(kept.data).toEqual({ name: "SQL", years: 7, evidence: "Pricing dashboards in SQL" });
      const changed = await editFact(tx, userId, { id: skill.id, version: kept.version, data: { name: "SQL", years: 7, evidence: "Weekly pricing dashboard in SQL" } });
      expect(changed.data).toEqual({ name: "SQL", years: 7, evidence: "Weekly pricing dashboard in SQL" });
      const [contact, link, project] = await tx
        .insert(profileFacts)
        .values([
          { userId, documentId: doc.id, kind: "contact", origin: "upload", status: "extracted", evidence: "Jack Miller", data: { name: "Jack Miller", email: "jack.miller@jobluvo.com" } },
          { userId, documentId: doc.id, kind: "link", origin: "upload", status: "extracted", evidence: "linkedin.com/in/jack", data: { url: "linkedin.com/in/jack" } },
          { userId, documentId: doc.id, kind: "project", origin: "upload", status: "extracted", evidence: "OKR rollout", data: { name: "OKR rollout" } },
        ])
        .returning({ id: profileFacts.id, version: profileFacts.version });
      expect((await editFact(tx, userId, { id: contact.id, version: contact.version, data: { name: "Jack Miller", email: "jack@jobluvo.com", location: "Istanbul" } })).data).toEqual({ name: "Jack Miller", email: "jack@jobluvo.com", location: "Istanbul" });
      await expect(editFact(tx, userId, { id: contact.id, version: contact.version + 1, data: { name: "", email: "" } })).rejects.toMatchObject({ reason: "invalid" });
      expect((await editFact(tx, userId, { id: link.id, version: link.version, data: { url: "github.com/jack" } })).data).toEqual({ url: "github.com/jack" });
      await expect(editFact(tx, userId, { id: link.id, version: link.version + 1, data: { url: "" } })).rejects.toMatchObject({ reason: "invalid" });
      expect((await editFact(tx, userId, { id: project.id, version: project.version, data: { name: "OKR rollout", notes: ["38 teams"] } })).data).toEqual({ name: "OKR rollout", notes: ["38 teams"] });
      // A confirm bound to the version the stale page showed is skipped; at the current version it moves.
      expect(await decideFacts(tx, userId, { confirm: [{ id: emp.id, version: 1 }] })).toMatchObject({ confirmed: 0, skipped: [emp.id] });
      expect(await decideFacts(tx, userId, { confirm: [{ id: emp.id, version: 2 }] })).toMatchObject({ confirmed: 1, skipped: [] });
      await expect(editFact(tx, userId, { id: emp.id, version: 2, data: row.data as Record<string, unknown> })).rejects.toMatchObject({ reason: "not_waiting" });
      expect((await resumeFacts(tx, userId))!.employment.find((e) => e.company === "New Co")!.bullets[1]).toBe("Ran the annual planning cycle.");
      // A replacement bound to what a stale page showed is refused when the waiting facts differ; bound to the current set it runs.
      await expect(replaceWithDocument(tx, userId, doc.id, [{ id: emp.id, version: 2 }, { id: skill.id, version: 1 }])).rejects.toMatchObject({ reason: "changed" });
      await expect(replaceWithDocument(tx, userId, doc.id, [{ id: skill.id, version: 2 }])).rejects.toMatchObject({ reason: "changed" });
      // An empty list on a document with waiting facts is the unbound form in another shape: refused the same way.
      await expect(replaceWithDocument(tx, userId, doc.id, [])).rejects.toMatchObject({ reason: "changed" });
      // Bound to the current set: the skill at its edited version and the contact, link and project added above.
      expect(await replaceWithDocument(tx, userId, doc.id, await seenOf(tx, userId, doc.id))).toEqual({ confirmed: 4, retired: 2 });
    });
  });

  it("documentState reads every state from the status and the counts", () => {
    const now = Date.now();
    const at = (ms: number) => new Date(now - ms);
    const d = (status: "processing" | "ready" | "failed", counts: Partial<{ extracted: number; confirmed: number; rejected: number }> = {}, age = 0) =>
      documentState({ status, uploadedAt: at(age), extracted: 0, confirmed: 0, rejected: 0, ...counts }, now);
    expect(d("processing")).toBe("processing");
    expect(d("processing", {}, PROCESSING_STALE_MS + 1)).toBe("failed");
    expect(d("failed", { confirmed: 5 })).toBe("failed");
    expect(d("ready", { extracted: 1, confirmed: 3 })).toBe("check");
    expect(d("ready", { confirmed: 3 })).toBe("verified");
    expect(d("ready", { rejected: 3 })).toBe("rejected");
    expect(d("ready")).toBe("empty");
  });

  it("a failure between the retirement and the confirmation rolls the retirement back", async () => {
    await withUser(async (tx, userId) => {
      await tx.insert(profileFacts).values(seedFacts(userId));
      const [doc] = await tx.insert(profileDocuments).values({ userId, filename: "resume.pdf", bytesPhase0: Buffer.from("%PDF"), text: "", status: "ready" }).returning({ id: profileDocuments.id });
      await tx.insert(profileFacts).values([{ userId, documentId: doc.id, kind: "employment", origin: "upload", status: "extracted", evidence: "x", data: { company: "New Co", title: "Head", start: "2022-03", bullets: ["New line."] } }]);
      // The replacement's second update, the confirmation, fails. The first, the retirement, has already run inside the same transaction.
      await expect(replaceWithDocument(failingOn(tx, 2), userId, doc.id, await seenOf(tx, userId, doc.id))).rejects.toThrow(/injected failure/);
      const f = (await resumeFacts(tx, userId))!;
      expect(f.employment.map((e) => e.company)).toEqual(["Old Co"]);
      expect(f.skills.map((s) => s.name)).toEqual(["Old skill"]);
      const status = await tx.select({ status: profileFacts.status }).from(profileFacts).where(and(eq(profileFacts.userId, userId), eq(profileFacts.documentId, doc.id)));
      expect(status).toEqual([{ status: "extracted" }]);
      // The transaction is still usable: the replacement runs clean afterwards.
      expect(await replaceWithDocument(tx, userId, doc.id, await seenOf(tx, userId, doc.id))).toEqual({ confirmed: 1, retired: 2 });
    });
  });

  it("a document with no extracted facts retires nothing", async () => {
    await withUser(async (tx, userId) => {
      await tx.insert(profileFacts).values(seedFacts(userId));
      const [empty] = await tx.insert(profileDocuments).values({ userId, filename: "failed.pdf", bytesPhase0: Buffer.from("%PDF"), text: "", status: "ready" }).returning({ id: profileDocuments.id });
      await expect(replaceWithDocument(tx, userId, empty.id, await seenOf(tx, userId, empty.id))).rejects.toMatchObject({ reason: "nothing_to_confirm", message: "nothing left to confirm from failed.pdf" });
      expect((await profileView(tx, userId)).documents.find((d) => d.id === empty.id)!.state).toBe("empty");
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
      const [a] = await db.insert(profileDocuments).values({ userId: user.id, filename: "a.pdf", bytesPhase0: Buffer.from("%PDF"), text: "", status: "ready" }).returning({ id: profileDocuments.id });
      const [b] = await db.insert(profileDocuments).values({ userId: user.id, filename: "b.pdf", bytesPhase0: Buffer.from("%PDF"), text: "", status: "ready" }).returning({ id: profileDocuments.id });
      await db.insert(profileFacts).values([
        { userId: user.id, documentId: a.id, kind: "employment", origin: "upload", status: "extracted", evidence: "x", data: { company: "A Co", title: "Head", start: "2022-03", bullets: ["A line."] } },
        { userId: user.id, documentId: a.id, kind: "skill", origin: "upload", status: "extracted", evidence: "x", data: { name: "A skill" } },
        { userId: user.id, documentId: b.id, kind: "employment", origin: "upload", status: "extracted", evidence: "x", data: { company: "B Co", title: "Head", start: "2023-03", bullets: ["B line."] } },
        { userId: user.id, documentId: b.id, kind: "skill", origin: "upload", status: "extracted", evidence: "x", data: { name: "B skill" } },
        { userId: user.id, documentId: b.id, kind: "contact", origin: "upload", status: "extracted", evidence: "x", data: { name: "Jack" } },
      ]);
      const [seenA, seenB] = await Promise.all([seenOf(db, user.id, a.id), seenOf(db, user.id, b.id)]);
      const [ra, rb] = await Promise.all([replaceWithDocument(db, user.id, a.id, seenA), replaceWithDocument(db, user.id, b.id, seenB)]);
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
