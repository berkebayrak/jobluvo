import { and, eq, inArray, sql } from "drizzle-orm";
import type { DbHttp, DbPool, Tx } from "@/db/client";
import { profileDocuments, profileFacts, type ProfileFact } from "@/db/schema";
import type { FactRef } from "./decision";
import { FACT_SCHEMAS } from "./facts";

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

/**
 * What the screen says about a document, from its extraction status and
 * its facts. Each state is its own word so a failed or empty document is
 * never shown as verified:
 *
 *   processing  the call is running
 *   failed      the call or the storing failed, or a processing document is
 *               older than the call budget, which means the function died
 *   check       ready, with facts waiting for a decision
 *   verified    ready, its facts confirmed, none waiting
 *   rejected    ready, its facts all rejected or retired by a later resume
 *   empty       ready, the extractor found nothing
 */
export type DocumentState = "processing" | "failed" | "check" | "verified" | "rejected" | "empty";

/** A processing document older than this is read as failed: the upload function has a 60 s ceiling and the call 40 s. */
export const PROCESSING_STALE_MS = 90_000;

export interface ProfileDocumentView {
  id: string;
  filename: string;
  uploadedAt: string;
  status: "processing" | "ready" | "failed";
  state: DocumentState;
  error: string | null;
  extracted: number;
  confirmed: number;
  rejected: number;
}

export interface ProfileView {
  documents: ProfileDocumentView[];
  facts: ProfileFact[];
}

export function documentState(d: { status: "processing" | "ready" | "failed"; uploadedAt: Date; extracted: number; confirmed: number; rejected: number }, now = Date.now()): DocumentState {
  if (d.status === "failed") return "failed";
  if (d.status === "processing") return now - d.uploadedAt.getTime() > PROCESSING_STALE_MS ? "failed" : "processing";
  if (d.extracted > 0) return "check";
  if (d.confirmed > 0) return "verified";
  if (d.rejected > 0) return "rejected";
  return "empty";
}

export async function profileView(db: DbHttp | DbPool | Tx, userId: string): Promise<ProfileView> {
  const [docs, facts] = await Promise.all([
    db
      .select({ id: profileDocuments.id, filename: profileDocuments.filename, uploadedAt: profileDocuments.uploadedAt, status: profileDocuments.status, error: profileDocuments.error })
      .from(profileDocuments)
      .where(eq(profileDocuments.userId, userId))
      .orderBy(sql`${profileDocuments.uploadedAt} desc`),
    db.select().from(profileFacts).where(eq(profileFacts.userId, userId)).orderBy(profileFacts.createdAt),
  ]);
  return {
    documents: docs.map((d) => {
      const counts = {
        extracted: facts.filter((f) => f.documentId === d.id && f.status === "extracted").length,
        confirmed: facts.filter((f) => f.documentId === d.id && f.status === "confirmed").length,
        rejected: facts.filter((f) => f.documentId === d.id && f.status === "rejected").length,
      };
      return {
        id: d.id,
        filename: d.filename,
        uploadedAt: d.uploadedAt.toISOString(),
        status: d.status,
        state: documentState({ status: d.status, uploadedAt: d.uploadedAt, ...counts }),
        error: d.error,
        ...counts,
      };
    }),
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
export async function decideFacts(db: DbPool | Tx, userId: string, decision: { confirm?: FactRef[]; reject?: FactRef[] }): Promise<DecideResult> {
  const confirm = decision.confirm ?? [];
  const reject = decision.reject ?? [];
  // Every decision names the version it saw; one update per version named. There is no unbound form.
  const groups = (refs: FactRef[]) => {
    const by = new Map<number, string[]>();
    for (const r of refs) by.set(r.version, [...(by.get(r.version) ?? []), r.id]);
    return [...by.entries()];
  };
  return db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${profileLockKey(userId)}))`);
    const moved = new Set<string>();
    for (const [version, ids] of groups(confirm)) {
      const rows = await tx
        .update(profileFacts)
        .set({ status: "confirmed", updatedAt: new Date() })
        .where(and(eq(profileFacts.userId, userId), inArray(profileFacts.id, ids), eq(profileFacts.status, "extracted"), eq(profileFacts.version, version)))
        .returning({ id: profileFacts.id });
      for (const r of rows) moved.add(r.id);
    }
    const confirmed = moved.size;
    let rejected = 0;
    for (const [version, ids] of groups(reject)) {
      const rows = await tx
        .update(profileFacts)
        .set({ status: "rejected", updatedAt: new Date() })
        .where(and(eq(profileFacts.userId, userId), inArray(profileFacts.id, ids), inArray(profileFacts.status, ["extracted", "confirmed"]), eq(profileFacts.version, version)))
        .returning({ id: profileFacts.id });
      rejected += rows.length;
      for (const r of rows) moved.add(r.id);
    }
    return {
      confirmed,
      rejected,
      asked: { confirm: confirm.length, reject: reject.length },
      skipped: [...confirm, ...reject].map((r) => r.id).filter((id) => !moved.has(id)),
    };
  });
}

/** An edit that changed nothing, with the reason the screen shows. */
export class EditRefused extends Error {
  constructor(
    public reason: "not_found" | "not_waiting" | "changed" | "invalid",
    message: string,
  ) {
    super(message);
  }
}

/**
 * Replaces a waiting fact's data with what the user typed. Only a fact
 * waiting for a decision can be edited here, at the version the page
 * showed; the data must satisfy the kind's schema in facts.ts, the origin
 * becomes "edit", the version moves on, and the fact stays waiting, so
 * what the user confirms next is the text they wrote and nothing else. The
 * evidence stays: it is what the resume said, which the edit corrects.
 */
export async function editFact(db: DbPool | Tx, userId: string, edit: { id: string; version: number; data: Record<string, unknown> }): Promise<{ id: string; version: number; data: Record<string, unknown> }> {
  return db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${profileLockKey(userId)}))`);
    const [fact] = await tx
      .select({ id: profileFacts.id, kind: profileFacts.kind, status: profileFacts.status, version: profileFacts.version })
      .from(profileFacts)
      .where(and(eq(profileFacts.userId, userId), eq(profileFacts.id, edit.id)));
    if (!fact) throw new EditRefused("not_found", "fact not found");
    if (fact.status !== "extracted") throw new EditRefused("not_waiting", "only a fact waiting for your decision can be edited here");
    if (fact.version !== edit.version) throw new EditRefused("changed", "this fact changed since the page loaded, check it again");
    const schema = FACT_SCHEMAS[fact.kind as keyof typeof FACT_SCHEMAS];
    const parsed = schema.safeParse(edit.data);
    if (!parsed.success) throw new EditRefused("invalid", parsed.error.issues.map((i) => `${i.path.join(".") || "value"}: ${i.message}`).join("; "));
    const [row] = await tx
      .update(profileFacts)
      .set({ data: parsed.data, origin: "edit", version: fact.version + 1, updatedAt: new Date() })
      .where(and(eq(profileFacts.id, fact.id), eq(profileFacts.version, fact.version)))
      .returning({ id: profileFacts.id, version: profileFacts.version, data: profileFacts.data });
    return { id: row.id, version: row.version, data: row.data as Record<string, unknown> };
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

/** A replacement that changed nothing, with the reason the screen shows. */
export class ReplaceRefused extends Error {
  constructor(
    public reason: "not_found" | "processing" | "failed" | "nothing_to_confirm" | "changed",
    message: string,
  ) {
    super(message);
  }
}

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
 * documents. Nothing is retired unless the document is ready and has at
 * least one extracted fact to confirm: a document whose extraction is still
 * running, failed or returned nothing cannot empty the profile, and the
 * refusal says which, so the screen never shows a click that did nothing
 * as done.
 */
export async function replaceWithDocument(db: DbPool | Tx, userId: string, documentId: string, seen: FactRef[]): Promise<{ confirmed: number; retired: number }> {
  return db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${profileLockKey(userId)}))`);
    const [doc] = await tx
      .select({ id: profileDocuments.id, filename: profileDocuments.filename, status: profileDocuments.status, uploadedAt: profileDocuments.uploadedAt })
      .from(profileDocuments)
      .where(and(eq(profileDocuments.id, documentId), eq(profileDocuments.userId, userId)));
    if (!doc) throw new ReplaceRefused("not_found", "document not found");
    const pending = await tx
      .select({ id: profileFacts.id, version: profileFacts.version })
      .from(profileFacts)
      .where(and(eq(profileFacts.userId, userId), eq(profileFacts.documentId, documentId), eq(profileFacts.status, "extracted")));
    const state = documentState({ status: doc.status, uploadedAt: doc.uploadedAt, extracted: pending.length, confirmed: 0, rejected: 0 });
    if (state === "processing") throw new ReplaceRefused("processing", `${doc.filename} is still being read`);
    if (state === "failed") throw new ReplaceRefused("failed", `${doc.filename} could not be read, so there is nothing to confirm`);
    if (pending.length === 0) throw new ReplaceRefused("nothing_to_confirm", `nothing left to confirm from ${doc.filename}`);
    // Bound to what the page displayed: the same waiting facts at the same versions, or nothing moves. Always: there is no
    // unbound form, since that is what let a caller confirm facts nobody had reviewed.
    const shown = new Map(seen.map((s) => [s.id, s.version]));
    const same = pending.length === shown.size && pending.every((p) => shown.get(p.id) === p.version);
    if (!same) throw new ReplaceRefused("changed", `the facts from ${doc.filename} changed since the page loaded, check them again`);
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
