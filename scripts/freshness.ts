import { sql } from "drizzle-orm";
import { dbHttp } from "@/db/client";
import { hardFilterSql, type FilterFacts } from "@/server/match/hardFilter";
import { authorizationFact, preferenceFact, sponsorshipFact } from "@/server/profile/facts";

/**
 * The shape of the fresh slice: how many jobs arrive per day and how many of
 * them pass the demo user's hard filter. `npm run freshness`.
 *
 * Two dates, because they answer different questions. `first_seen_at` is when
 * Jobluvo saw the job, so it measures the polling schedule, not the market:
 * a seed run puts a whole board on one day. `posted_at` is the board's own
 * date, so it estimates the real arrival rate independently of when we last
 * polled. The scoring cron will claim on first_seen_at, but posted_at is the
 * honest input to "is a 24 hour slice worth scoring".
 */

const DAYS = 14;

async function main() {
  const db = dbHttp();

  const facts = (
    await db.execute<{ kind: string; data: unknown }>(sql`
      select f.kind, f.data from profile_facts f join users u on u.id = f.user_id
      where u.email = 'jack.miller@jobluvo.com' and f.status = 'confirmed' and f.kind in ('authorization', 'sponsorship', 'preference')`)
  ).rows;
  const auth = facts.filter((f) => f.kind === "authorization").map((f) => authorizationFact.parse(f.data));
  const sponsorshipRow = facts.find((f) => f.kind === "sponsorship");
  const stored = facts.find((f) => f.kind === "preference");
  if (!sponsorshipRow || !stored) {
    console.error("Jack Miller has no confirmed sponsorship or preference fact. Run `npm run seed` first.");
    process.exit(2);
  }
  const f: FilterFacts = {
    prefs: preferenceFact.parse(stored.data),
    auth,
    sponsorship: sponsorshipFact.parse(sponsorshipRow.data),
  };
  const reason = hardFilterSql(f);
  console.log(`stored preference: ${JSON.stringify(f.prefs)}\n`);

  for (const [label, col] of [
    ["first seen by Jobluvo", sql`j.first_seen_at`],
    ["posted by the board", sql`j.posted_at`],
  ] as const) {
    const rows = (
      await db.execute<{ day: string; fresh: number; pass: number }>(sql`
        select to_char(${col}, 'YYYY-MM-DD') as day,
               count(*)::int as fresh,
               count(*) filter (where (${reason}) is null)::int as pass
        from jobs j join sources s on s.id = j.source_id
        where j.closed_at is null and ${col} >= now() - ${`${DAYS} days`}::interval
        group by 1 order by 1 desc`)
    ).rows;
    const total = rows.reduce((n, r) => n + Number(r.fresh), 0);
    const pass = rows.reduce((n, r) => n + Number(r.pass), 0);
    console.log(`fresh jobs per day, ${label}, last ${DAYS} days`);
    console.table(
      rows.map((r) => ({
        day: r.day,
        fresh: Number(r.fresh),
        pass: Number(r.pass),
        "pass %": r.fresh ? Math.round((1000 * Number(r.pass)) / Number(r.fresh)) / 10 : 0,
      })),
    );
    console.log(`${total} fresh in the window, ${pass} passing, ${Math.round((10 * total) / DAYS) / 10} a day\n`);

    const fam = (
      await db.execute<{ family: string; day: string; fresh: number; pass: number }>(sql`
        select s.family, to_char(${col}, 'MM-DD') as day,
               count(*)::int as fresh, count(*) filter (where (${reason}) is null)::int as pass
        from jobs j join sources s on s.id = j.source_id
        where j.closed_at is null and ${col} >= now() - ${`${DAYS} days`}::interval
        group by 1, 2`)
    ).rows;
    const byFamily = new Map<string, Record<string, unknown>>();
    for (const r of fam) {
      const row = byFamily.get(r.family) ?? { family: r.family, fresh: 0, pass: 0 };
      row[r.day] = Number(r.fresh);
      row.fresh = Number(row.fresh) + Number(r.fresh);
      row.pass = Number(row.pass) + Number(r.pass);
      byFamily.set(r.family, row);
    }
    console.log(`the same split by family, ${label}`);
    console.table([...byFamily.values()].sort((a, b) => Number(b.fresh) - Number(a.fresh)));
    console.log("");
  }

  const undated = (
    await db.execute<{ family: string; jobs: number }>(sql`
      select s.family, count(*)::int as jobs from jobs j join sources s on s.id = j.source_id
      where j.closed_at is null and j.posted_at is null group by 1 order by 2 desc`)
  ).rows;
  if (undated.length) {
    console.log("open jobs with no posted_at, which the board date table cannot see");
    console.table(undated.map((r) => ({ family: r.family, jobs: Number(r.jobs) })));
  }
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
