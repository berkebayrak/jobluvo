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

/**
 * Confirms every extracted fact of the document and retires the confirmed
 * resume facts that are not from it. After this the confirmed profile is the
 * document's facts plus the user's own preference, authorization and
 * sponsorship answers.
 */
export async function replaceWithDocument(db: DbPool | Tx, userId: string, documentId: string): Promise<{ confirmed: number; retired: number }> {
  const [doc] = await db.select({ id: profileDocuments.id }).from(profileDocuments).where(and(eq(profileDocuments.id, documentId), eq(profileDocuments.userId, userId)));
  if (!doc) throw new Error("document not found");
  const retiredRows = await db
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
  const confirmedRows = await db
    .update(profileFacts)
    .set({ status: "confirmed", updatedAt: new Date() })
    .where(and(eq(profileFacts.userId, userId), eq(profileFacts.documentId, documentId), eq(profileFacts.status, "extracted")))
    .returning({ id: profileFacts.id });
  return { confirmed: confirmedRows.length, retired: retiredRows.length };
}
