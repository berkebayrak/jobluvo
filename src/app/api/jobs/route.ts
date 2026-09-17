import { feedForUser } from "@/server/jobs/feed";
import { viewerFacts } from "@/server/profile/viewer";
import { currentUserId } from "@/server/user";

/** Reads the database on every call; never prerendered at build. */
export const dynamic = "force-dynamic";

export async function GET() {
  const userId = await currentUserId();
  const [jobs, viewer] = await Promise.all([feedForUser(userId), viewerFacts(userId)]);
  return Response.json({ jobs, viewer });
}
