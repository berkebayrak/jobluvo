import { neon } from "@neondatabase/serverless";

/**
 * Hard filter pass rate across the ingested jobs, before any scoring runs.
 * `npm run pass-rate`.
 *
 * The filter is provisional: it stands in for Jack Miller's preference and
 * authorization facts until PR 2 stores them. From the mock profile: needs
 * visa sponsorship, wants a US location or US remote, full time, manager or
 * director level. A job fails on the first reason in this order: location,
 * sponsorship, employment type, seniority. The independent counts show how
 * many jobs each rule cuts on its own, so the order does not hide a rule.
 */

const US_LOCATION = `exists (select 1 from jsonb_array_elements(j.locations) l where l->>'country' = 'US')`;
const REMOTE_UNKNOWN = `(j.workplace = 'remote' or exists (select 1 from jsonb_array_elements(j.locations) l where (l->>'remote')::boolean))
  and not exists (select 1 from jsonb_array_elements(j.locations) l where l->>'country' is not null)`;
const REASON = `case
  when ${US_LOCATION} then null
  when ${REMOTE_UNKNOWN} then 'remote, country unknown'
  else 'not US' end`;
const FIRST_REASON = `coalesce(${REASON},
  case when j.sponsorship = 'not_offered' then 'sponsorship not offered' end,
  case when j.employment_type is not null and j.employment_type <> 'Full time' then 'employment type' end,
  case when j.seniority in ('Intern', 'Junior') then 'seniority' end)`;

async function main() {
  const sql = neon(process.env.DATABASE_URL!);
  const base = `from jobs j join sources s on s.id = j.source_id where j.closed_at is null`;

  console.log("overall");
  console.table(
    await sql.query(`select count(*)::int as open_jobs, count(*) filter (where ${FIRST_REASON} is null)::int as pass,
      round(100.0 * count(*) filter (where ${FIRST_REASON} is null) / count(*), 1) as pass_pct,
      count(*) filter (where j.detail_pending)::int as detail_pending ${base}`),
  );

  console.log("by family");
  console.table(
    await sql.query(`select s.family, count(*)::int as open_jobs, count(*) filter (where ${FIRST_REASON} is null)::int as pass,
      round(100.0 * count(*) filter (where ${FIRST_REASON} is null) / count(*), 1) as pass_pct ${base}
      group by s.family order by open_jobs desc`),
  );

  console.log("first failing reason, by family");
  console.table(
    await sql.query(`select coalesce(${FIRST_REASON}, 'pass') as reason, s.family, count(*)::int as jobs ${base}
      group by 1, 2 order by 1, 3 desc`),
  );

  console.log("each rule on its own (a job can count under several)");
  console.table(
    await sql.query(`select count(*) filter (where not ${US_LOCATION} and not (${REMOTE_UNKNOWN}))::int as "not US",
      count(*) filter (where ${REMOTE_UNKNOWN})::int as "remote, country unknown",
      count(*) filter (where j.sponsorship = 'not_offered')::int as "sponsorship not offered",
      count(*) filter (where j.sponsorship = 'unknown')::int as "sponsorship unknown",
      count(*) filter (where j.employment_type is not null and j.employment_type <> 'Full time')::int as "employment type",
      count(*) filter (where j.employment_type is null)::int as "employment type unknown",
      count(*) filter (where j.seniority in ('Intern', 'Junior'))::int as "seniority",
      count(*) filter (where j.seniority is null)::int as "seniority unknown" ${base}`),
  );

  console.log("US jobs by seniority");
  console.table(
    await sql.query(`select coalesce(j.seniority, '(unknown)') as seniority, count(*)::int as us_jobs,
      count(*) filter (where ${FIRST_REASON} is null)::int as pass ${base} and ${US_LOCATION}
      group by 1 order by 2 desc`),
  );
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
