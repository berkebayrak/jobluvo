import { sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { dbPool, type Tx } from "@/db/client";
import { jobs, sources, type JobLocation, type NewJob } from "@/db/schema";
import { hardFilterSql, type FilterFacts } from "./hardFilter";
import type { AuthorizationFact, PreferenceFact, SponsorshipFact } from "@/server/profile/facts";

/*
 * The hard filter against fixture rows in the real database. Every test
 * runs inside one transaction that is rolled back at the end, so the shared
 * database is left exactly as it was; a Neon branch would do the same with
 * an API key this environment does not have.
 *
 * Without DATABASE_URL these tests skip, and the run says so at the end
 * (vitest.reporter.ts). With DATABASE_URL set, a database that cannot be
 * reached fails the run rather than skipping it, so a clean clone cannot
 * report success with the most important tests never run.
 */

const hasDb = !!process.env.DATABASE_URL;

type Fixture = Partial<NewJob> & { name: string; locations?: JobLocation[] };

const FIXTURES: Fixture[] = [
  { name: "onsite US", workplace: "onsite", locations: [{ raw: "New York, NY", city: "New York", region: "NY", country: "US" }] },
  { name: "hybrid US", workplace: "hybrid", locations: [{ raw: "Chicago, IL", city: "Chicago", region: "IL", country: "US" }] },
  { name: "remote US", workplace: "remote", locations: [{ raw: "Remote - US", remote: true, country: "US" }] },
  { name: "remote unknown", workplace: "remote", locations: [{ raw: "Remote", remote: true }] },
  { name: "onsite FR", workplace: "onsite", locations: [{ raw: "Paris, France", city: "Paris", country: "FR" }] },
  { name: "onsite GB", workplace: "onsite", locations: [{ raw: "London, United Kingdom", city: "London", country: "GB" }] },
  { name: "remote GB", workplace: "remote", locations: [{ raw: "Remote, UK", remote: true, country: "GB" }] },
  { name: "citizenship US", workplace: "onsite", eligibility: "citizenship", eligibilityCountry: "US", locations: [{ raw: "Austin, TX", city: "Austin", region: "TX", country: "US" }] },
  { name: "residency US", workplace: "onsite", eligibility: "permanent_residency", eligibilityCountry: "US", locations: [{ raw: "Austin, TX", city: "Austin", region: "TX", country: "US" }] },
  { name: "right to work GB", workplace: "onsite", eligibility: "right_to_work", eligibilityCountry: "GB", locations: [{ raw: "London", city: "London", country: "GB" }] },
  { name: "right to work unnamed US", workplace: "onsite", eligibility: "right_to_work", locations: [{ raw: "Denver, CO", city: "Denver", region: "CO", country: "US" }] },
  { name: "clearance US", workplace: "onsite", eligibility: "clearance", eligibilityCountry: "US", locations: [{ raw: "Reston, VA", city: "Reston", region: "VA", country: "US" }] },
  { name: "no sponsorship US", workplace: "onsite", sponsorship: "not_offered", locations: [{ raw: "Seattle, WA", city: "Seattle", region: "WA", country: "US" }] },
  { name: "contract US", workplace: "onsite", employmentType: "Contract", locations: [{ raw: "Boston, MA", city: "Boston", region: "MA", country: "US" }] },
  { name: "blocked company US", workplace: "onsite", companyName: "Acme Blocked", locations: [{ raw: "Miami, FL", city: "Miami", region: "FL", country: "US" }] },
  { name: "blocked word US", workplace: "onsite", title: "Pre-sales Engineer", locations: [{ raw: "Miami, FL", city: "Miami", region: "FL", country: "US" }] },
];

const BASE_PREFS: PreferenceFact = { targetCountries: ["US"], relocation: "yes", remote: "remote_ok", employmentTypes: ["Full time"] };
const NEED_NOW: SponsorshipFact = { now: true, future: true, statedOn: "2026-09-17" };
const facts = (prefs: Partial<PreferenceFact> = {}, auth: AuthorizationFact[] = [], sponsorship: SponsorshipFact | null = NEED_NOW): FilterFacts => ({
  prefs: { ...BASE_PREFS, ...prefs } as PreferenceFact,
  auth,
  sponsorship,
});

class Rollback extends Error {}

/** Runs `fn` with the fixtures inserted, then rolls everything back. */
async function withFixtures(fn: (evaluate: (f: FilterFacts) => Promise<Record<string, string | null>>) => Promise<void>) {
  const db = dbPool();
  await db
    .transaction(async (tx: Tx) => {
      const [src] = await tx
        .insert(sources)
        .values({ family: "greenhouse", tenant: `hard-filter-test-${Date.now()}`, companyName: "Fixture Co", companyDomain: null })
        .returning({ id: sources.id });
      const rows = await tx
        .insert(jobs)
        .values(
          FIXTURES.map((f, i) => ({
            sourceId: src.id,
            family: "greenhouse" as const,
            nativeId: `fx-${i}`,
            title: f.title ?? `Fixture ${f.name}`,
            titleNorm: `fixture ${f.name}`,
            companyName: f.companyName ?? "Fixture Co",
            companyDomain: null,
            locations: f.locations ?? [],
            workplace: f.workplace ?? "unknown",
            employmentType: f.employmentType ?? "Full time",
            sponsorship: f.sponsorship ?? "unknown",
            eligibility: f.eligibility ?? null,
            eligibilityCountry: f.eligibilityCountry ?? null,
            eligibilityEvidence: f.eligibility ? "fixture sentence" : null,
            descriptionText: "",
            descriptionHtml: "",
            descriptionCore: "",
            contentHash: `fx-${i}`,
            applyUrl: `https://example.com/${i}`,
            applyUrlNorm: `https://example.com/${i}`,
          })),
        )
        .returning({ id: jobs.id, nativeId: jobs.nativeId });
      const byId = new Map(rows.map((r) => [r.id, FIXTURES[Number(r.nativeId.slice(3))].name]));
      const ids = rows.map((r) => r.id);
      const evaluate = async (f: FilterFacts) => {
        const res = await tx.execute<{ id: string; reason: string | null }>(
          sql`select j.id, (${hardFilterSql(f)}) as reason from jobs j where j.id in (${sql.join(
            ids.map((id) => sql`${id}::uuid`),
            sql`, `,
          )})`,
        );
        const out: Record<string, string | null> = {};
        for (const r of res.rows) out[byId.get(r.id)!] = r.reason;
        return out;
      };
      await fn(evaluate);
      throw new Rollback();
    })
    .catch((e) => {
      if (!(e instanceof Rollback)) throw e;
    });
}

afterAll(async () => {
  const g = globalThis as unknown as { __jobluvoPool?: { end(): Promise<void> } };
  await g.__jobluvoPool?.end();
});

describe.skipIf(!hasDb)("hardFilterSql against fixture rows", () => {
  beforeAll(async () => {
    try {
      await dbPool().execute(sql`select 1`);
    } catch (e) {
      throw new Error(`DATABASE_URL is set but the database cannot be reached: ${e instanceof Error ? e.message : String(e)}`);
    }
  });

  it("applies each remote preference", async () => {
    await withFixtures(async (evaluate) => {
      const ok = await evaluate(facts({ remote: "remote_ok" }));
      expect(ok["onsite US"]).toBeNull();
      expect(ok["hybrid US"]).toBeNull();
      expect(ok["remote US"]).toBeNull();
      expect(ok["remote unknown"]).toBe("remote, country unknown");
      expect(ok["onsite FR"]).toBe("not in target countries");
      expect(ok["remote GB"]).toBe("not in target countries");

      const only = await evaluate(facts({ remote: "remote_only" }));
      expect(only["onsite US"]).toBe("not remote");
      expect(only["hybrid US"]).toBe("not remote");
      expect(only["remote US"]).toBeNull();
      expect(only["remote unknown"]).toBe("remote, country unknown");

      const none = await evaluate(facts({ remote: "no_remote" }));
      expect(none["remote US"]).toBe("remote role");
      expect(none["remote unknown"]).toBe("remote role");
      expect(none["onsite US"]).toBeNull();
      expect(none["hybrid US"]).toBeNull();
      expect(none["onsite FR"]).toBe("not in target countries");

      const anywhere = await evaluate(facts({ targetCountries: "any", remote: "remote_only" }));
      expect(anywhere["remote unknown"]).toBeNull();
      expect(anywhere["remote GB"]).toBeNull();
      expect(anywhere["onsite FR"]).toBe("not remote");
    });
  });

  it("applies each relocation value, with the target countries as the fallback", async () => {
    await withFixtures(async (evaluate) => {
      const yes = await evaluate(facts({ targetCountries: ["US", "GB"], relocation: "yes" }));
      expect(yes["onsite US"]).toBeNull();
      expect(yes["onsite GB"]).toBeNull();

      const stayGb = await evaluate(facts({ targetCountries: ["US", "GB"], relocation: "no", onsiteCountries: ["GB"] }));
      expect(stayGb["onsite GB"]).toBeNull();
      expect(stayGb["onsite US"]).toBe("relocation");
      expect(stayGb["remote US"]).toBeNull();

      // No list: the target countries stand in, so nothing in reach is rejected.
      const fallback = await evaluate(facts({ targetCountries: ["US"], relocation: "no", onsiteCountries: undefined }));
      expect(fallback["onsite US"]).toBeNull();
      expect(fallback["onsite FR"]).toBe("not in target countries");

      // "any" with no list: nothing to hold the user to.
      const anyNo = await evaluate(facts({ targetCountries: "any", relocation: "no", onsiteCountries: undefined }));
      expect(anyNo["onsite FR"]).toBeNull();
    });
  });

  it("checks each restriction kind against the authorization facts", async () => {
    await withFixtures(async (evaluate) => {
      const stated = (basis: AuthorizationFact["basis"], country = "US"): AuthorizationFact => ({ country, basis, statedOn: "2026-09-17" });

      const none = await evaluate(facts({}, [stated("none")]));
      expect(none["citizenship US"]).toBe("citizenship required");
      expect(none["residency US"]).toBe("permanent residency required");
      expect(none["right to work unnamed US"]).toBe("right to work required");
      expect(none["clearance US"]).toBe("needs a security clearance, Jobluvo does not handle these");

      const permit = await evaluate(facts({}, [stated("work_permit")]));
      expect(permit["citizenship US"]).toBe("citizenship required");
      expect(permit["residency US"]).toBe("permanent residency required");
      expect(permit["right to work unnamed US"]).toBeNull();

      const resident = await evaluate(facts({}, [stated("permanent_resident")]));
      expect(resident["citizenship US"]).toBe("citizenship required");
      expect(resident["residency US"]).toBeNull();

      const citizen = await evaluate(facts({}, [stated("citizen")]));
      expect(citizen["citizenship US"]).toBeNull();
      expect(citizen["residency US"]).toBeNull();
      expect(citizen["right to work unnamed US"]).toBeNull();
      expect(citizen["clearance US"]).toBe("needs a security clearance, Jobluvo does not handle these");

      const gb = await evaluate(facts({ targetCountries: ["US", "GB"] }, [stated("work_permit", "GB")]));
      expect(gb["right to work GB"]).toBeNull();
      const noGb = await evaluate(facts({ targetCountries: ["US", "GB"] }, [stated("citizen", "US")]));
      expect(noGb["right to work GB"]).toBe("right to work required");
    });
  });

  it("applies sponsorship, employment type, blocked companies and blocked words, and passes the unknown", async () => {
    await withFixtures(async (evaluate) => {
      const needs = await evaluate(facts({ excludedCompanies: ["acme blocked"], excludedKeywords: ["pre-sales"] }, [], NEED_NOW));
      expect(needs["no sponsorship US"]).toBe("sponsorship not offered");
      expect(needs["contract US"]).toBe("employment type");
      expect(needs["blocked company US"]).toBe("excluded company");
      expect(needs["blocked word US"]).toBe("excluded keyword");
      expect(needs["onsite US"]).toBeNull();

      const authorised = await evaluate(facts({}, [{ country: "US", basis: "work_permit", statedOn: "2026-09-17" }], NEED_NOW));
      expect(authorised["no sponsorship US"]).toBeNull();

      const noNeed = await evaluate(facts({}, [], { now: false, future: false, statedOn: "2026-09-17" }));
      expect(noNeed["no sponsorship US"]).toBeNull();

      const anyType = await evaluate(facts({ employmentTypes: undefined }));
      expect(anyType["contract US"]).toBeNull();
    });
  });
});
