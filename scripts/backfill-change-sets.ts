import { readFileSync } from "node:fs";
import { join } from "node:path";
import { and, eq, isNull, sql } from "drizzle-orm";
import { dbPool } from "@/db/client";
import { packets } from "@/db/schema";
import { parseFlags } from "@/lib/cli";
import type { ResumeFacts } from "@/server/match/profile";
import { sameDocument } from "@/server/packet/replay";
import { applyChanges, baseResume, type ChangeSet } from "@/server/packet/resume";

/*
 * Fills change_set and attempt on packets stored before they were kept
 * (review four, finding 2), from a snapshot's saved answers and nothing
 * else: the retained attempt's change set is taken from the file, the
 * candidate is rebuilt from the profile the snapshot froze, and the row is
 * written only when that candidate is the stored resume exactly, skill
 * order included. Nothing is reconstructed by guesswork; a packet the file
 * does not cover, or whose rebuilt candidate differs, is left null and
 * counted.
 *
 *   npm run backfill-change-sets -- --dir design/snapshots/2026-09-18-packets --answers families-18sep-saved-answers.json
 *   npm run backfill-change-sets -- ... --apply      write the rows; without it, a dry run
 */

type Saved = { jobId: string; attemptLog: (string | { outcome: string })[]; changeSets: (ChangeSet | null)[] };
type Profile = { factsHash: string; facts: ResumeFacts };

const outcomeOf = (a: string | { outcome: string }) => (typeof a === "string" ? a : a.outcome);

/** The attempt the run keeps (src/server/packet/run.ts): the last, unless a held answer's retry came back rejected or failed. */
function retainedIndex(outcomes: string[]): number {
  const last = outcomes.length - 1;
  const before = outcomes[last - 1];
  return before === "needs_review" && (outcomes[last] === "invalid" || outcomes[last] === "failed") ? last - 1 : last;
}

async function main() {
  const { values, booleans } = parseFlags(process.argv.slice(2), { booleans: ["apply"], values: ["dir", "answers"] } as const);
  const dir = values.dir ?? "design/snapshots/2026-09-18-packets";
  const saved = JSON.parse(readFileSync(join(dir, values.answers ?? "families-18sep-saved-answers.json"), "utf8")) as Saved[];
  const profiles = JSON.parse(readFileSync(join(dir, "profiles.json"), "utf8")) as Record<string, Profile>;
  const byJob = new Map(saved.map((o) => [o.jobId, o]));
  const db = dbPool();
  const rows = await db
    .select({ id: packets.id, jobId: packets.jobId, status: packets.status, resume: packets.resume, factsHash: packets.factsHash, updatedAt: sql<string>`${packets.updatedAt}::text` })
    .from(packets)
    .where(isNull(packets.changeSet));
  const counts = { candidates: rows.length, notInFile: 0, noProfile: 0, noCandidate: 0, differs: 0, verified: 0, written: 0, stale: 0 };
  const writes: { id: string; updatedAt: string; cs: ChangeSet; attempt: number }[] = [];
  for (const r of rows) {
    const o = byJob.get(r.jobId);
    if (!o) {
      counts.notInFile += 1;
      continue;
    }
    const profile = profiles[r.factsHash];
    if (!profile) {
      counts.noProfile += 1;
      continue;
    }
    const idx = retainedIndex(o.attemptLog.map(outcomeOf));
    const cs = o.changeSets[idx];
    if (!cs) {
      counts.noCandidate += 1;
      continue;
    }
    const base = baseResume(profile.facts);
    const rebuilt = applyChanges(base, cs).resume;
    // An invalid packet stores no resume; its change set is still its candidate. A stored resume must be the rebuilt one exactly.
    if (r.resume && !sameDocument(r.resume, rebuilt)) {
      counts.differs += 1;
      continue;
    }
    counts.verified += 1;
    writes.push({ id: r.id, updatedAt: r.updatedAt, cs, attempt: idx + 1 });
  }
  if (booleans.apply) {
    for (const w of writes) {
      const done = await db
        .update(packets)
        .set({ changeSet: w.cs, attempt: w.attempt })
        .where(and(eq(packets.id, w.id), sql`${packets.updatedAt}::text = ${w.updatedAt}`))
        .returning({ id: packets.id });
      if (done.length) counts.written += 1;
      else counts.stale += 1;
    }
  }
  console.log(JSON.stringify({ dir, apply: booleans.apply, ...counts }, null, 1));
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
