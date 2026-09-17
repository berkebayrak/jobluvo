import { and, eq } from "drizzle-orm";
import { dbHttp } from "@/db/client";
import { profileFacts } from "@/db/schema";
import { sponsorshipFact } from "@/server/profile/facts";

/** What the feed needs to know about the person looking at it. */
export interface ViewerFacts {
  /** True when a confirmed sponsorship fact says the user needs it now or in future. */
  needsSponsorship: boolean;
}

export async function viewerFacts(userId: string): Promise<ViewerFacts> {
  const rows = await dbHttp()
    .select({ data: profileFacts.data })
    .from(profileFacts)
    .where(and(eq(profileFacts.userId, userId), eq(profileFacts.kind, "sponsorship"), eq(profileFacts.status, "confirmed")));
  const parsed = rows.map((r) => sponsorshipFact.safeParse(r.data)).find((r) => r.success);
  return { needsSponsorship: parsed?.success ? parsed.data.now || parsed.data.future : false };
}
