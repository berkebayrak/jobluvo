import { dbPool } from "@/db/client";
import { profileView } from "@/server/profile/confirm";
import { currentUserId } from "@/server/user";

/** Reads the database on every call; never prerendered at build. */
export const dynamic = "force-dynamic";

/**
 * GET /api/profile: the user's documents and every fact with its kind,
 * origin, status and evidence, so the profile screen can show what is
 * confirmed and what is waiting for a decision.
 */
export async function GET() {
  const userId = await currentUserId();
  return Response.json(await profileView(dbPool(), userId));
}
