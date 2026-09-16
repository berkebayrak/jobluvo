import { neon } from "@neondatabase/serverless";

/** Prints the state of the registry, the jobs, the groups and the cost rows. `npm run db:status`. */
async function main() {
  const sql = neon(process.env.DATABASE_URL!);
  console.log("sources");
  console.table(
    await sql`select family, tenant, last_status as status, job_count as open, consecutive_failures as fails,
      left(last_error, 50) as err, to_char(last_polled_at, 'HH24:MI:SS') as polled, boilerplate_version as bp
      from sources order by family, tenant`,
  );
  const unclaimed = await sql`select tenant from sources where active and last_polled_at is null`;
  console.log(
    unclaimed.length
      ? `WARNING: ${unclaimed.length} active source(s) with null last_polled_at, would be claimed first forever: ${unclaimed.map((r) => r.tenant).join(", ")}`
      : "every active source has a last_polled_at",
  );
  console.log("jobs by family");
  console.table(
    await sql`select family, count(*)::int as jobs, count(closed_at)::int as closed,
      count(*) filter (where detail_pending)::int as pending from jobs group by family order by family`,
  );
  console.log("group links by reason");
  console.table(await sql`select reason, count(*)::int as links from job_group_links group by reason order by reason`);
  console.log("groups", (await sql`select count(*)::int as n from job_groups`)[0].n);
  const singletons = (
    await sql`select count(*)::int as n from (select group_id from job_group_links group by group_id having count(*) < 2) t`
  )[0].n;
  if (singletons) console.log(`WARNING: ${singletons} group(s) with a single member, a link was lost`);
  console.log("similarity log");
  console.table(
    await sql`select merged, count(*)::int as pairs, round(avg(score)::numeric, 3) as avg_score,
      round(min(score)::numeric, 3) as min_score from similarity_log group by merged`,
  );
  console.log("cost events");
  console.table(await sql`select kind, count(*)::int as n, sum(ms)::int as ms, round(sum(usd)::numeric, 4) as usd from cost_events group by kind`);
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
