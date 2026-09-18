import { existsSync, readFileSync } from "node:fs";
import { Pool } from "@neondatabase/serverless";

/*
 * Wakes the database once, before any test asks it anything.
 *
 * Neon's free plan suspends the compute after five minutes idle and that
 * cannot be turned off, so the first query of a run pays a cold start. The
 * suite spent an afternoon failing on that: whichever database backed file
 * happened to go first lost the race, its 10 second hook or 30 second test
 * timed out, and the failure landed on a different file each run, which is
 * why it read like a defect in whatever had changed last. It was not. A run
 * started minutes after another one passed, because the compute was still
 * awake.
 *
 * So the cold start is paid here, once, deliberately, and every test that
 * follows meets a compute that is already up. Nothing else changes: no test
 * timeout is raised and no failure is retried. A cold start is a real
 * condition of the platform this runs on, and waiting for it once in the
 * open is the honest way to absorb it. Raising the timeouts instead would
 * hide a slow database behind numbers nobody could read.
 *
 * This waits as long as the wake takes. If the database is genuinely
 * unreachable the error surfaces here, with its own text, before a single
 * test has run, which is a far better thing to read than a timeout.
 *
 * No DATABASE_URL, nothing to wake: the database backed tests skip
 * themselves and this returns.
 */

/** `.env.local` again, because a global setup runs before `setupFiles`. Values already set win. */
function loadEnv() {
  if (!existsSync(".env.local")) return;
  for (const line of readFileSync(".env.local", "utf8").split(/\r?\n/)) {
    const m = /^([A-Z_][A-Z0-9_]*)=(.*)$/.exec(line);
    if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2];
  }
}

export default async function setup() {
  loadEnv();
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    process.stdout.write("no DATABASE_URL, nothing to wake; the database backed tests will skip themselves\n");
    return;
  }
  const started = Date.now();
  const pool = new Pool({ connectionString });
  try {
    await pool.query("select 1");
    const ms = Date.now() - started;
    // Printed every run: a number that climbs into the seconds is the compute having been asleep, not the suite slowing down.
    process.stdout.write(`database awake in ${ms} ms${ms > 2000 ? " (cold start paid here rather than by whichever test went first)" : ""}\n`);
  } finally {
    await pool.end();
  }
}
