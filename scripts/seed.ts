import { and, eq, inArray } from "drizzle-orm";
import { dbPool } from "@/db/client";
import { profileFacts, sources, users } from "@/db/schema";
import { authorizationFact, preferenceFact, sponsorshipFact } from "@/server/profile/facts";
import { DEMO_USER_EMAIL } from "@/server/user";
import { SEED_SOURCES } from "@/server/sources/registry";
import { ADAPTERS } from "@/server/sources/registry";

/*
 * Jack Miller's preference, authorization and sponsorship facts, entered as
 * the user would enter them (origin user, status confirmed). They mirror the
 * profile screen mock: targets the United States, will relocate US wide,
 * takes remote or on site, full time, is not authorized to work in the US
 * and needs sponsorship now and in future. Nothing here comes from where
 * Jack lives.
 */
const JACK_FACTS = [
  {
    kind: "preference" as const,
    data: preferenceFact.parse({
      targetCountries: ["US"],
      relocation: "yes",
      remote: "remote_ok",
      employmentTypes: ["Full time"],
      earliestStart: "2026-11-01",
    }),
  },
  { kind: "authorization" as const, data: authorizationFact.parse({ country: "US", basis: "none", statedOn: "2026-09-17" }) },
  { kind: "sponsorship" as const, data: sponsorshipFact.parse({ now: true, future: true, statedOn: "2026-09-17" }) },
];

/**
 * Seeds the demo user, Jack's user entered facts and the source registry.
 * Every seed source is fetched first; one that does not answer with at least
 * one posting is skipped and listed, so the registry never carries a dead
 * board.
 *
 * Run with `npm run seed`. Safe to run again: it upserts, and a fact kind
 * Jack already has is left alone so edits made on the profile screen survive.
 */
async function main() {
  const db = dbPool();

  const [user] = await db
    .insert(users)
    .values({ name: "Jack Miller", email: DEMO_USER_EMAIL, jobluvoAddress: DEMO_USER_EMAIL })
    .onConflictDoNothing({ target: users.email })
    .returning();
  console.log(user ? `user created ${user.id}` : "user already present");

  const [jack] = await db.select({ id: users.id }).from(users).where(eq(users.email, DEMO_USER_EMAIL));
  const kinds = JACK_FACTS.map((f) => f.kind);
  const present = await db
    .select({ kind: profileFacts.kind })
    .from(profileFacts)
    .where(and(eq(profileFacts.userId, jack.id), inArray(profileFacts.kind, kinds)));
  const have = new Set(present.map((r) => r.kind));
  const missing = JACK_FACTS.filter((f) => !have.has(f.kind));
  if (missing.length) {
    await db.insert(profileFacts).values(missing.map((f) => ({ userId: jack.id, kind: f.kind, data: f.data, origin: "user" as const, status: "confirmed" as const })));
  }
  console.log(`facts: ${missing.length} added (${missing.map((f) => f.kind).join(", ") || "none"}), ${have.size} already present`);

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
