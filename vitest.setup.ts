import { existsSync, readFileSync } from "node:fs";

/*
 * Loads .env.local into process.env for the tests that need a database,
 * without a dependency. Values already set win. Tests that need
 * DATABASE_URL skip themselves when it is absent, so `npm test` passes on a
 * machine with no .env.local.
 */
if (existsSync(".env.local")) {
  for (const line of readFileSync(".env.local", "utf8").split(/\r?\n/)) {
    const m = /^([A-Z_][A-Z0-9_]*)=(.*)$/.exec(line);
    if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2];
  }
}
