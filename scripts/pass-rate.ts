import { sql } from "drizzle-orm";
import { dbHttp } from "@/db/client";
import { hardFilterSql, type FilterFacts } from "@/server/match/hardFilter";
import { authorizationFact, preferenceFact, sponsorshipFact, type PreferenceFact } from "@/server/profile/facts";

/**
 * Hard filter pass rate across the ingested jobs, as a matrix.
 * `npm run pass-rate`.
 *
 * The filter is the one in src/server/match/hardFilter.ts, JOB-06, built
 * from the demo user's confirmed authorization and sponsorship facts. The
 * target countries are varied across four realistic sets so the cost of the
 * filter and the cost of the registry show up separately: a low pass rate
 * for "United States only" against a high one for "Western Europe" is the
 * seed boards, not the rule.
 */

const WESTERN_EUROPE = ["GB", "IE", "FR", "DE", "NL", "BE", "LU", "ES", "PT", "IT", "CH", "AT", "DK", "SE", "NO", "FI"];

const BASE: Omit<PreferenceFact, "targetCountries"> = { relocation: "yes", remote: "remote_ok", employmentTypes: ["Full time"] };
const SCENARIOS: { name: string; prefs: PreferenceFact }[] = [
  { name: "United States only", prefs: { ...BASE, targetCountries: ["US"] } },
  { name: "US, Britain, Ireland, Canada", prefs: { ...BASE, targetCountries: ["US", "GB", "IE", "CA"] } },
  { name: "Western Europe", prefs: { ...BASE, targetCountries: WESTERN_EUROPE } },
  { name: "Remote anywhere", prefs: { ...BASE, targetCountries: "any", remote: "remote_only" } },
];

async function main() {
  const db = dbHttp();

  const facts = (
    await db.execute<{ kind: string; data: unknown }>(sql`
      select f.kind, f.data from profile_facts f join users u on u.id = f.user_id
      where u.email = 'jack.miller@jobluvo.com' and f.status = 'confirmed' and f.kind in ('authorization', 'sponsorship', 'preference')`)
  ).rows;
  const auth = facts.filter((f) => f.kind === "authorization").map((f) => authorizationFact.parse(f.data));
  const sponsorshipRow = facts.find((f) => f.kind === "sponsorship");
  const sponsorship = sponsorshipRow ? sponsorshipFact.parse(sponsorshipRow.data) : null;
  const stored = facts.find((f) => f.kind === "preference");
  if (!sponsorship || !stored) {
    console.error("Jack Miller has no confirmed sponsorship or preference fact. Run `npm run seed` first.");
    process.exit(2);
  }
  console.log(
    `facts: authorization ${auth.map((a) => `${a.country}:${a.basis}`).join(", ") || "none"}; sponsorship now ${sponsorship.now}, future ${sponsorship.future}, stated ${sponsorship.statedOn}`,
  );
  console.log(`stored preference: ${JSON.stringify(preferenceFact.parse(stored.data))}\n`);

  const base = sql`from jobs j join sources s on s.id = j.source_id where j.closed_at is null`;
  const matrix: Record<string, unknown>[] = [];
  const byFamily: Record<string, Record<string, unknown>> = {};
  for (const sc of SCENARIOS) {
    const f: FilterFacts = { prefs: preferenceFact.parse(sc.prefs), auth, sponsorship };
    const reason = hardFilterSql(f);
    const rows = (
      await db.execute<{ reason: string; jobs: number }>(
        sql`select coalesce(${reason}, 'pass') as reason, count(*)::int as jobs ${base} group by 1 order by 2 desc`,
      )
    ).rows;
    const total = rows.reduce((n, r) => n + Number(r.jobs), 0);
    const pass = Number(rows.find((r) => r.reason === "pass")?.jobs ?? 0);
    const row: Record<string, unknown> = { scenario: sc.name, pass, "pass %": Math.round((1000 * pass) / total) / 10 };
    for (const r of rows) if (r.reason !== "pass") row[r.reason] = Number(r.jobs);
    matrix.push(row);

    const fam = (
      await db.execute<{ family: string; jobs: number; pass: number }>(
        sql`select s.family, count(*)::int as jobs, count(*) filter (where (${reason}) is null)::int as pass ${base} group by 1 order by 2 desc`,
      )
    ).rows;
    for (const r of fam) {
      byFamily[r.family] ??= { family: r.family, jobs: Number(r.jobs) };
      byFamily[r.family][sc.name] = Number(r.pass);
    }
  }

  console.log("quiet postings, sponsorship unknown, that state an eligibility restriction");
  console.table(
    (
      await db.execute(sql`select coalesce(j.eligibility::text, '(none)') as restriction, coalesce(j.eligibility_country, '') as country,
      count(*)::int as jobs ${base} and j.sponsorship = 'unknown' group by 1, 2 order by 3 desc`)
    ).rows,
  );

  console.log("jobs passing, and the first failing reason for the rest");
  console.table(matrix);
  console.log("jobs passing by family (what the registry costs)");
  console.table(Object.values(byFamily));
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
