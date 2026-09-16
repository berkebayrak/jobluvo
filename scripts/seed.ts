import { eq } from "drizzle-orm";
import { dbPool } from "@/db/client";
import { sources, users } from "@/db/schema";
import { DEMO_USER_EMAIL } from "@/server/user";
import { SEED_SOURCES } from "@/server/sources/registry";
import { ADAPTERS } from "@/server/sources/registry";

/**
 * Seeds the demo user and the source registry. Every seed source is fetched
 * first; one that does not answer with at least one posting is skipped and
 * listed, so the registry never carries a dead board.
 *
 * Run with `npm run seed`. Safe to run again: it upserts.
 */
async function main() {
  const db = dbPool();

  const [user] = await db
    .insert(users)
    .values({ name: "Jack Miller", email: DEMO_USER_EMAIL, jobluvoAddress: DEMO_USER_EMAIL })
    .onConflictDoNothing({ target: users.email })
    .returning();
  console.log(user ? `user created ${user.id}` : "user already present");

  let added = 0;
  const skipped: string[] = [];
  for (const s of SEED_SOURCES) {
    const probe = { ...s, id: "", active: true, etag: null, lastPolledAt: null, lastStatus: null, lastError: null, consecutiveFailures: 0, jobCount: 0, boilerplateVersion: 0, boilerplate: [], createdAt: new Date() };
    try {
      const r = await ADAPTERS[s.family].fetch(probe, { detailBudget: 0, known: new Map() });
      const n = r.notModified ? -1 : r.postings.length;
      if (n <= 0) {
        skipped.push(`${s.family}/${s.tenant}: ${n === 0 ? "no postings" : "not modified without etag"}`);
        continue;
      }
      await db
        .insert(sources)
        .values({ family: s.family, tenant: s.tenant, companyName: s.companyName, companyDomain: s.companyDomain })
        .onConflictDoUpdate({
          target: [sources.family, sources.tenant],
          set: { companyName: s.companyName, companyDomain: s.companyDomain },
        });
      added += 1;
      console.log(`ok   ${s.family}/${s.tenant}  ${n} postings`);
    } catch (err) {
      skipped.push(`${s.family}/${s.tenant}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
  const total = await db.select({ id: sources.id }).from(sources).where(eq(sources.active, true));
  console.log(`\n${added} sources seeded, ${total.length} active in the registry`);
  if (skipped.length) console.log(`skipped:\n  ${skipped.join("\n  ")}`);
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
