import { neon, type NeonQueryFunction } from "@neondatabase/serverless";
import type { JobLocation } from "@/db/schema";
import { parseLocations } from "@/server/jobs/normalize";

/**
 * Re-parses the stored locations of every job of the free text families,
 * Greenhouse, Ashby and Gem, with the current parser.
 * `npm run db:backfill-locations`.
 *
 * Lever, Workable and SmartRecruiters hand over structured city, region and
 * country fields, which are not stored on the job row, so for those three
 * the backfill is a poll: clear the source's etag and run `npm run ingest --
 * <tenant>`, and every location is rewritten from the feed.
 *
 * Safe to run any number of times. content_hash reads only the raw location
 * string, never the parsed city, region or country, so a re-parse cannot
 * change a hash, cannot look like changed content and cannot trigger a
 * rescore. The remote flag is passed back in as the hint the adapter gave.
 */

const FREE_TEXT_FAMILIES = ["greenhouse", "ashby", "gem"];

const stable = (l: JobLocation) => JSON.stringify(Object.fromEntries(Object.entries(l).sort()));

async function usCounts(sql: NeonQueryFunction<false, false>) {
  const rows = (await sql`
    select count(*)::int as open_jobs,
      count(*) filter (where exists (select 1 from jsonb_array_elements(locations) l where l->>'country' = 'US'))::int as any_us_location,
      count(*) filter (where exists (select 1 from jsonb_array_elements(locations) l where l->>'country' = 'US')
                          or workplace = 'remote')::int as us_or_remote,
      (select count(*)::int from jobs j, jsonb_array_elements(j.locations) l where j.closed_at is null and l->>'country' is null) as entries_without_country
    from jobs where closed_at is null`) as Record<string, number>[];
  return rows[0];
}

async function main() {
  const sql = neon(process.env.DATABASE_URL!);
  console.log("before");
  console.table([await usCounts(sql)]);

  const rows = (await sql`select id, locations from jobs where family = any(${FREE_TEXT_FAMILIES}::family[])`) as {
    id: string;
    locations: JobLocation[];
  }[];
  const updates: [string, string][] = [];
  for (const r of rows) {
    const next = parseLocations(
      r.locations.map((old) => ({ raw: old.raw, remote: old.remote })),
    );
    if (next.map(stable).join("|") !== r.locations.map(stable).join("|")) updates.push([r.id, JSON.stringify(next)]);
  }

  const chunk = 200;
  for (let i = 0; i < updates.length; i += chunk) {
    const slice = updates.slice(i, i + chunk);
    const values = slice.map((_, k) => `($${k * 2 + 1}::uuid, $${k * 2 + 2}::jsonb)`).join(", ");
    await sql.query(`update jobs as j set locations = v.locations from (values ${values}) as v(id, locations) where j.id = v.id`, slice.flat());
  }
  console.log(`scanned ${rows.length} free text family jobs, re-parsed ${updates.length}`);

  console.log("after");
  console.table([await usCounts(sql)]);
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
