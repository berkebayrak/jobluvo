import { dbPool } from "@/db/client";
import { decideFacts, replaceWithDocument } from "@/server/profile/confirm";
import { decisionBody } from "@/server/profile/decision";
import { currentUserId } from "@/server/user";

export const dynamic = "force-dynamic";

/**
 * POST /api/profile/facts. Either { confirm: [ids], reject: [ids] } for
 * single decisions, or { replaceWith: documentId } to confirm every
 * extracted fact of that document and retire the confirmed resume facts
 * that came before it.
 */
export async function POST(req: Request) {
  const parsed = decisionBody.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "bad request" }, { status: 400 });
  const userId = await currentUserId();
  const db = dbPool();
  if ("replaceWith" in parsed.data) {
    try {
      return Response.json(await replaceWithDocument(db, userId, parsed.data.replaceWith));
    } catch (e) {
      return Response.json({ error: e instanceof Error ? e.message : String(e) }, { status: 404 });
    }
  }
  return Response.json(await decideFacts(db, userId, parsed.data));
}
