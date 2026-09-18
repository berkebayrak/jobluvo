import { dbPool } from "@/db/client";
import { cellStats, citationStats, runStats, unknownCostStats } from "@/server/match/report";

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
  console.log(
    "lines not supported by what they cite, by run and by kind, from the packets on hand. Every column counts cited bullet edits, the same unit as citedEdits; anyKind is lines failing in at least one way and is not the sum, since a line can fail in two. unrecognised counts lines whose findings carry a code this build does not know, which would otherwise read as zero of everything",
  );
  console.table(await citationStats(db));
  console.log("calls of unknown cost: marked rows timed out or lost the connection, stale rows are what a killed function left behind; worst case at the kind's mean per call, beside the recorded USD");
  console.table(await unknownCostStats(db));
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
