import { dbPool } from "@/db/client";
import { claimTenant, ingestBatch, ingestSource, type SourceRun } from "@/server/sources/ingest";

/**
 * Runs one ingest locally and prints one line per source.
 *   npm run ingest            claims INGEST_BATCH sources, oldest first
 *   npm run ingest -- 3       claims three
 *   npm run ingest -- zego    polls that tenant only, whatever its claim state
 */
async function main() {
  const arg = process.argv[2];
  let runs: SourceRun[];
  if (arg && !/^\d+$/.test(arg)) {
    const db = dbPool();
    // Claimed like any other poll, so last_polled_at is stamped and the
    // scheduler never sees a polled source with a null.
    const rows = await claimTenant(db, arg);
    if (!rows.length) {
      console.error(`no source with tenant "${arg}"`);
      process.exit(2);
    }
    runs = [];
    for (const s of rows) runs.push(await ingestSource(db, s));
  } else {
    runs = await ingestBatch(arg ? Number(arg) : undefined);
  }
  if (!runs.length) console.log("nothing claimed: every source was polled recently or none is active");
  for (const r of runs) {
    const line = `${r.status.padEnd(12)} ${r.family}/${r.tenant}`.padEnd(44);
    console.log(
      `${line} +${r.inserted} ~${r.updated} closed ${r.closed} linked ${r.linked} pending ${r.detailPending} ${r.ms}ms${r.error ? `  ${r.error}` : ""}`,
    );
  }
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
