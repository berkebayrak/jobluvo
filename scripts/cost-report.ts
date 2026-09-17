import { dbPool } from "@/db/client";
import { cellStats, citationStats, runStats } from "@/server/match/report";

/**
 * Cost per scoring call from cost_events, one block per run tag, the cron
 * under "cron". Percentiles first, the mean beside them (D-003).
 * `npm run cost-report`, or `npm run cost-report -- --by family|length|seniority`.
 */
async function main() {
  const db = dbPool();
  const i = process.argv.indexOf("--by");
  const by = (i >= 0 ? process.argv[i + 1] : "family") as "family" | "length" | "seniority";
  console.log("USD per scoring call by run");
  console.table(await runStats(db));
  console.log(`by ${by}`);
  console.table(await cellStats(db, by));
  console.log("wrong citations by run, from the packets on hand");
  console.table(await citationStats(db));
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
