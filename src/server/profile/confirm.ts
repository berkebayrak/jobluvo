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

export interface DecideResult {
  confirmed: number;
  rejected: number;
  /** How many ids each list asked for. A moved count under its asked count means stale ids, and `skipped` names them. */
  asked: { confirm: number; reject: number };
  /** Ids that did not move: not this user's, already in that state, or a retired fact that a decide may not revive. */
  skipped: string[];
}

/**
 * Confirms or rejects the given facts of this user, one at a time by id.
 *
 * The rule: confirm moves a fact out of extracted and nowhere else. A
 * rejected fact stays rejected here, whether the user rejected it or a
 * replacement retired it, because a retired fact re-entering the confirmed
 * set is a fact from a previous resume in the profile the filter, the
 * scorer and the tailor read; undoing that is a replace, not a decide.
 * Reject moves a fact out of extracted or confirmed. Every other id is
 * skipped and reported, so a stale page cannot look like a success.
 *
 * Same transaction and same per user lock as the replacement: these are the
 * same rows, and a decide racing a replace without the lock could confirm a
 * fact the replacement is retiring.
 */
export async function decideFacts(db: DbPool | Tx, userId: string, decision: { confirm?: string[]; reject?: string[] }): Promise<DecideResult> {
  const confirm = decision.confirm ?? [];
  const reject = decision.reject ?? [];
  return db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${profileLockKey(userId)}))`);
    const moved = new Set<string>();
    if (confirm.length) {
      const rows = await tx
        .update(profileFacts)
        .set({ status: "confirmed", updatedAt: new Date() })
        .where(and(eq(profileFacts.userId, userId), inArray(profileFacts.id, confirm), eq(profileFacts.status, "extracted")))
        .returning({ id: profileFacts.id });
      for (const r of rows) moved.add(r.id);
    }
    const confirmed = moved.size;
    let rejected = 0;
    if (reject.length) {
      const rows = await tx
        .update(profileFacts)
        .set({ status: "rejected", updatedAt: new Date() })
        .where(and(eq(profileFacts.userId, userId), inArray(profileFacts.id, reject), inArray(profileFacts.status, ["extracted", "confirmed"])))
        .returning({ id: profileFacts.id });
      rejected = rows.length;
      for (const r of rows) moved.add(r.id);
    }
    return {
      confirmed,
      rejected,
      asked: { confirm: confirm.length, reject: reject.length },
      skipped: [...confirm, ...reject].filter((id) => !moved.has(id)),
    };
  });
}

/**
 * The advisory lock key for one user's profile, so every write to that
 * user's facts, decide and replace alike, serialises on the same lock.
 *
 * This and the employer lock in jobs/identity.ts both hash into the one
 * argument advisory lock space with hashtext, which is 32 bit. The prefix
 * stops a literal collision, but a profile write can in principle wait
 * behind an unrelated employer poll on a hash collision. Negligible at
 * this size. Whoever adds the third lock type should move all of them to
 * the two argument form, pg_advisory_xact_lock(namespace, key), with a
 * distinct namespace per lock type.
 */
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
