import { and, eq, inArray } from "drizzle-orm";
import { dbHttp, type DbHttp, type DbPool, type Tx } from "@/db/client";
import { profileFacts } from "@/db/schema";
import type { FilterFacts } from "@/server/match/hardFilter";
import { authorizationFact, preferenceFact, sponsorshipFact } from "@/server/profile/facts";

/** What the feed needs to know about the person looking at it. */
export interface ViewerFacts {
  /** True when a confirmed sponsorship fact says the user needs it now or in future. */
  needsSponsorship: boolean;
}

/**
 * The confirmed facts the hard filter reads, or null when the user has no
 * confirmed preference fact yet, in which case there is nothing to enforce
 * and the feed shows the whole inventory.
 */
export async function filterFacts(userId: string, db: DbHttp | DbPool | Tx = dbHttp()): Promise<FilterFacts | null> {
  const rows = await db
    .select({ kind: profileFacts.kind, data: profileFacts.data })
    .from(profileFacts)
    .where(
      and(
        eq(profileFacts.userId, userId),
        eq(profileFacts.status, "confirmed"),
        inArray(profileFacts.kind, ["preference", "authorization", "sponsorship"]),
      ),
    );
  const pref = rows.filter((r) => r.kind === "preference").map((r) => preferenceFact.safeParse(r.data)).find((r) => r.success);
  if (!pref?.success) return null;
  const auth = rows
    .filter((r) => r.kind === "authorization")
    .map((r) => authorizationFact.safeParse(r.data))
    .flatMap((r) => (r.success ? [r.data] : []));
  const sp = rows.filter((r) => r.kind === "sponsorship").map((r) => sponsorshipFact.safeParse(r.data)).find((r) => r.success);
  return { prefs: pref.data, auth, sponsorship: sp?.success ? sp.data : null };
}

export async function viewerFacts(userId: string): Promise<ViewerFacts> {
  const facts = await filterFacts(userId);
  const sp = facts?.sponsorship;
  return { needsSponsorship: sp ? sp.now || sp.future : false };
}
