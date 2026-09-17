import { and, eq, inArray, sql } from "drizzle-orm";
import type { DbHttp, DbPool, Tx } from "@/db/client";
import { profileDocuments, profileFacts, type ProfileFact } from "@/db/schema";

/*
 * Confirmation (ID-03). Nothing extracted is read by the filter, the scorer
 * or the tailor until the user confirms it, and the origin and state of
 * every fact are kept. Two actions:
 *
 *   decide     confirm or reject single facts by id
 *   replace    confirm every extracted fact of one document and retire the
 *              confirmed resume facts that came before it, so the profile is
 *              the resume the user just confirmed and nothing else. Retired
 *              facts are kept as rejected, never deleted: a packet built on
 *              them can still be read (DOC-06).
 *
 * Preference, authorization and sponsorship facts are never touched here.
 * They are the user's own answers, not resume content.
 */

const RESUME_KINDS = ["contact", "link", "employment", "education", "project", "skill", "answer"] as const;

export interface ProfileView {
  documents: { id: string; filename: string; uploadedAt: string; extracted: number; confirmed: number }[];
  facts: ProfileFact[];
}

export async function profileView(db: DbHttp | DbPool | Tx, userId: string): Promise<ProfileView> {
  const [docs, facts] = await Promise.all([
    db
      .select({ id: profileDocuments.id, filename: profileDocuments.filename, uploadedAt: profileDocuments.uploadedAt })
      .from(profileDocuments)
      .where(eq(profileDocuments.userId, userId))
      .orderBy(sql`${profileDocuments.uploadedAt} desc`),
    db.select().from(profileFacts).where(eq(profileFacts.userId, userId)).orderBy(profileFacts.createdAt),
  ]);
  return {
    documents: docs.map((d) => ({
      id: d.id,
      filename: d.filename,
      uploadedAt: d.uploadedAt.toISOString(),
      extracted: facts.filter((f) => f.documentId === d.id && f.status === "extracted").length,
      confirmed: facts.filter((f) => f.documentId === d.id && f.status === "confirmed").length,
    })),
    facts,
  };
}

/** Confirms or rejects the given facts of this user. Ids that are not the user's are ignored. */
export async function decideFacts(db: DbPool | Tx, userId: string, decision: { confirm?: string[]; reject?: string[] }): Promise<{ confirmed: number; rejected: number }> {
  let confirmed = 0;
  let rejected = 0;
  if (decision.confirm?.length) {
    const rows = await db
      .update(profileFacts)
      .set({ status: "confirmed", updatedAt: new Date() })
      .where(and(eq(profileFacts.userId, userId), inArray(profileFacts.id, decision.confirm)))
      .returning({ id: profileFacts.id });
    confirmed = rows.length;
  }
  if (decision.reject?.length) {
    const rows = await db
      .update(profileFacts)
      .set({ status: "rejected", updatedAt: new Date() })
      .where(and(eq(profileFacts.userId, userId), inArray(profileFacts.id, decision.reject)))
      .returning({ id: profileFacts.id });
    rejected = rows.length;
  }
  return { confirmed, rejected };
}

/** The advisory lock key for one user's profile, so every replacement for that user serialises on the same lock. */
export const profileLockKey = (userId: string) => `profile:${userId}`;

/**
 * Confirms every extracted fact of the document and retires the confirmed
 * resume facts that are not from it. After this the confirmed profile is the
 * document's facts plus the user's own preference, authorization and
 * sponsorship answers.
 *
 * One transaction, opened here so the route and the tests run the same
 * path: on the pool it is a real transaction, inside a test transaction it
 * is a savepoint. The retirement and the confirmation stand or fall
 * together; a failure after the retirement rolls it back rather than
 * leaving the user with no confirmed resume. Replacements for one user are
 * serialised on a transaction scoped advisory lock (the same pattern as
 * the employer lock in jobs/identity.ts), so two at once run one after the
 * other and the second sees the first's result, never a mix of both
 * documents. Nothing is retired unless the document has at least one
 * extracted fact to confirm: a document whose extraction failed or returned
 * nothing cannot empty the profile.
 */
export async function replaceWithDocument(db: DbPool | Tx, userId: string, documentId: string): Promise<{ confirmed: number; retired: number }> {
  return db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${profileLockKey(userId)}))`);
    const [doc] = await tx.select({ id: profileDocuments.id }).from(profileDocuments).where(and(eq(profileDocuments.id, documentId), eq(profileDocuments.userId, userId)));
    if (!doc) throw new Error("document not found");
    const pending = await tx
      .select({ id: profileFacts.id })
      .from(profileFacts)
      .where(and(eq(profileFacts.userId, userId), eq(profileFacts.documentId, documentId), eq(profileFacts.status, "extracted")));
    if (pending.length === 0) return { confirmed: 0, retired: 0 };
    const retiredRows = await tx
      .update(profileFacts)
      .set({ status: "rejected", updatedAt: new Date() })
      .where(
        and(
          eq(profileFacts.userId, userId),
          eq(profileFacts.status, "confirmed"),
          inArray(profileFacts.kind, [...RESUME_KINDS]),
          sql`${profileFacts.documentId} is distinct from ${documentId}`,
        ),
      )
      .returning({ id: profileFacts.id });
    const confirmedRows = await tx
      .update(profileFacts)
      .set({ status: "confirmed", updatedAt: new Date() })
      .where(
        and(
          eq(profileFacts.userId, userId),
          inArray(
            profileFacts.id,
            pending.map((p) => p.id),
          ),
          eq(profileFacts.status, "extracted"),
        ),
      )
      .returning({ id: profileFacts.id });
    if (confirmedRows.length !== pending.length) throw new Error(`confirmed ${confirmedRows.length} of ${pending.length} extracted facts; nothing was changed`);
    return { confirmed: confirmedRows.length, retired: retiredRows.length };
  });
}
