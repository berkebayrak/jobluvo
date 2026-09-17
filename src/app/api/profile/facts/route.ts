import { dbPool } from "@/db/client";
import { decideFacts, editFact, EditRefused, ReplaceRefused, replaceWithDocument } from "@/server/profile/confirm";
import { decisionBody } from "@/server/profile/decision";
import { currentUserId } from "@/server/user";

export const dynamic = "force-dynamic";

/**
 * POST /api/profile/facts. Either { confirm: [ids], reject: [ids] } for
 * single decisions, or { replaceWith: documentId } to confirm every
 * extracted fact of that document and retire the confirmed resume facts
 * that came before it.
 *
 * Both answers carry counts of what moved against what was asked. A
 * replacement that would change nothing is refused with its reason: 404
 * when the document is not the user's, 409 when it is still being read,
 * failed, or has nothing left to confirm. The page shows the reason rather
 * than "done".
 */
export async function POST(req: Request) {
  const parsed = decisionBody.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "bad request" }, { status: 400 });
  const userId = await currentUserId();
  const db = dbPool();
  if ("replaceWith" in parsed.data) {
    try {
      return Response.json(await replaceWithDocument(db, userId, parsed.data.replaceWith, parsed.data.seen));
    } catch (e) {
      if (e instanceof ReplaceRefused) return Response.json({ error: e.message, reason: e.reason }, { status: e.reason === "not_found" ? 404 : 409 });
      throw e;
    }
  }
  if ("edit" in parsed.data) {
    try {
      return Response.json(await editFact(db, userId, parsed.data.edit));
    } catch (e) {
      if (e instanceof EditRefused) return Response.json({ error: e.message, reason: e.reason }, { status: e.reason === "not_found" ? 404 : e.reason === "invalid" ? 422 : 409 });
      throw e;
    }
  }
  return Response.json(await decideFacts(db, userId, parsed.data));
}
