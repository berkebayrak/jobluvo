import { feedForUser } from "@/server/jobs/feed";
import { currentUserId } from "@/server/user";

/** Reads the database on every call; never prerendered at build. */
export const dynamic = "force-dynamic";

export async function GET() {
  const userId = await currentUserId();
  const jobs = await feedForUser(userId);
  return Response.json({ jobs });
}
