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
 *
 * Both answers carry counts of what moved against what was asked. A
 * replacement with nothing to confirm answers 200 with confirmed 0 and
 * retired 0, and the page today shows that as done; making it explicit,
 * with the document's extraction state and the page confirming the
 * document it displays, is review finding 5.
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
