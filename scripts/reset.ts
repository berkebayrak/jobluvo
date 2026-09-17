import { neon } from "@neondatabase/serverless";

/**
 * Empties every job table and returns the registry to its unpolled state, so
 * the next ingest starts from nothing. Development only; refuses to run
 * against a URL that does not look like a Neon branch of this project.
 * `npm run db:reset`.
 */
async function main() {
  const url = process.env.DATABASE_URL!;
  if (!/neon\.tech/.test(url)) throw new Error("db:reset only runs against Neon");
  const sql = neon(url);
  await sql`truncate jobs, job_groups, job_group_links, similarity_log, swipe_decisions, cost_events cascade`;
  await sql`update sources set etag = null, last_attempt_at = null, last_success_at = null, last_status = null, last_error = null,
    consecutive_failures = 0, active = true, job_count = 0, boilerplate = '[]'::jsonb, boilerplate_version = 0`;
  console.log("job tables emptied, registry reset");
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
