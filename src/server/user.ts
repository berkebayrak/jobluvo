import { eq } from "drizzle-orm";
import { dbHttp } from "@/db/client";
import { users } from "@/db/schema";

export const DEMO_USER_EMAIL = "jack.miller@jobluvo.com";

let cachedId: string | null = null;

/**
 * Phase 0 has no sign in. Every request acts as the seeded demo user. This is
 * the one place that assumption lives, so real auth replaces one function.
 */
export async function currentUserId(): Promise<string> {
  if (cachedId) return cachedId;
  const rows = await dbHttp().select({ id: users.id }).from(users).where(eq(users.email, DEMO_USER_EMAIL)).limit(1);
  if (!rows.length) throw new Error("Demo user is missing. Run `npm run seed`.");
  cachedId = rows[0].id;
  return cachedId;
}
