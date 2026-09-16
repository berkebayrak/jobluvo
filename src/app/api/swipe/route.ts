import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { dbHttp } from "@/db/client";
import { swipeDecisions } from "@/db/schema";
import { currentUserId } from "@/server/user";

const body = z.object({
  jobId: z.string().uuid(),
  decision: z.enum(["apply", "save", "skip"]),
  reason: z.string().max(500).optional(),
});

/** Records a decision. The feed excludes swiped jobs through a live join, so this is all it takes. */
export async function POST(req: Request) {
  const parsed = body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "bad request" }, { status: 400 });
  const userId = await currentUserId();
  const db = dbHttp();
  await db.delete(swipeDecisions).where(and(eq(swipeDecisions.userId, userId), eq(swipeDecisions.jobId, parsed.data.jobId)));
  const [row] = await db
    .insert(swipeDecisions)
    .values({ userId, jobId: parsed.data.jobId, decision: parsed.data.decision, reason: parsed.data.reason })
    .returning();
  return Response.json({ decision: row });
}

/** Undo. Removes the decision; the job is back in the feed on the next read. */
export async function DELETE(req: Request) {
  const jobId = new URL(req.url).searchParams.get("jobId");
  if (!jobId) return Response.json({ error: "jobId required" }, { status: 400 });
  const userId = await currentUserId();
  await dbHttp().delete(swipeDecisions).where(and(eq(swipeDecisions.userId, userId), eq(swipeDecisions.jobId, jobId)));
  return Response.json({ ok: true });
}
