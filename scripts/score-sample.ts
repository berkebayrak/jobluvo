import { sql } from "drizzle-orm";
import { dbPool } from "@/db/client";
import { costEvents } from "@/db/schema";
import { withRep } from "@/server/jobs/feed";
import { hardFilterSql } from "@/server/match/hardFilter";
import { scoringProfile } from "@/server/match/profile";
import { cellStats, runStats } from "@/server/match/report";
import { loadScoringJobs, scoreClaimed } from "@/server/match/run";
import { ScoreError, scoreJob } from "@/server/match/score";
import { filterFacts } from "@/server/profile/viewer";
import { currentUserId } from "@/server/user";

/*
 * The phase 0 instrument (D-003): scores a stratified sample of about 100 of
 * the demo user's passing jobs and prints the cost distribution. Two runs
 * over the same jobs:
 *
 *   <tag>-prefix   profile first, the shipped order; writes match rows and
 *                  cost rows, so the feed shows these scores
 *   <tag>-nocache  job first, so nothing before the job can be cached;
 *                  writes cost rows only, tagged, never a match row
 *
 * The difference between the two is what the prefix order is worth.
 *
 *   npm run score-sample                       both runs, 100 jobs
 *   npm run score-sample -- --n 40             fewer jobs
 *   npm run score-sample -- --only prefix      one run
 *   npm run score-sample -- --dry              print the sample, call nothing
 *   npm run score-sample -- --tag sample-x     the run tag prefix, default sample-<today>
 *   npm run score-sample -- --reclaim          score again jobs the sample already holds a match row for
 *
 * The sample is drawn round robin over cells of family, seniority and
 * description length with a fixed seed, so it is repeatable and every cell
 * that exists is represented. It over weights long descriptions against
 * the feed on purpose; that is why its rows are tagged.
 */

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? (process.argv[i + 1] ?? "true") : undefined;
}

/** Deterministic shuffle: mulberry32 over the seed, Fisher Yates over the list. */
function shuffle<T>(xs: T[], seed: number): T[] {
  let a = seed >>> 0;
  const rand = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const out = [...xs];
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rand() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

const lengthBucket = (n: number) => (n < 2500 ? "short" : n < 5000 ? "medium" : "long");

async function main() {
  const n = Number(arg("n") ?? 100);
  const only = arg("only");
  const dry = arg("dry") === "true";
  const tag = arg("tag") ?? `sample-${new Date().toISOString().slice(0, 10)}`;
  const reclaim = arg("reclaim") === "true";
  const db = dbPool();
  const userId = await currentUserId();
  const [profile, facts] = await Promise.all([scoringProfile(db, userId), filterFacts(userId, db)]);
  if (!profile || !facts) throw new Error("the demo user has no confirmed profile; run npm run seed");
  console.log(`profile block: ${profile.block.length} chars, about ${Math.ceil(profile.block.length / 4)} tokens by the chars/4 rule; ${JSON.stringify(profile.counts)}`);

  const cand = await db.execute<{ id: string; family: string; seniority: string | null; len: number }>(sql`
    ${withRep(userId, hardFilterSql(facts))}
    select j.id, j.family::text as family, j.seniority, length(j.description_core)::int as len
    from rep join jobs j on j.id = rep.id
    where rep.reason is null and j.description_core <> ''
  `);
  const cells = new Map<string, string[]>();
  for (const r of cand.rows) {
    const key = `${r.family}|${r.seniority ?? "not stated"}|${lengthBucket(r.len)}`;
    (cells.get(key) ?? cells.set(key, []).get(key)!).push(r.id);
  }
  const keys = [...cells.keys()].sort();
  const queues = keys.map((k) => shuffle(cells.get(k)!, 20260917 + k.length));
  const chosen: string[] = [];
  const perCell = new Map<string, number>();
  for (let round = 0; chosen.length < n; round += 1) {
    let any = false;
    for (let i = 0; i < keys.length && chosen.length < n; i += 1) {
      const id = queues[i][round];
      if (!id) continue;
      any = true;
      chosen.push(id);
      perCell.set(keys[i], (perCell.get(keys[i]) ?? 0) + 1);
    }
    if (!any) break;
  }
  console.log(`candidates ${cand.rows.length} in ${keys.length} cells; sample ${chosen.length}`);
  console.table(keys.map((k) => ({ cell: k, candidates: cells.get(k)!.length, sampled: perCell.get(k) ?? 0 })));
  if (dry) return;

  if (only !== "nocache") {
    const run = `${tag}-prefix`;
    const rows = await db.execute<{ id: string; job_id: string; attempts: number }>(sql`
      insert into matches (user_id, job_id, prefs_hash, facts_hash, content_hash, status, attempts, claimed_at)
      select ${userId}, j.id, ${profile.prefsHash}, ${profile.factsHash}, j.content_hash, 'pending', 1, now()
      from jobs j where j.id in (${sql.join(chosen.map((id) => sql`${id}::uuid`), sql`, `)})
      on conflict (user_id, job_id) do ${reclaim ? sql`update set status = 'pending', attempts = 1, claimed_at = now(), updated_at = now(), prefs_hash = excluded.prefs_hash, facts_hash = excluded.facts_hash, content_hash = excluded.content_hash, error = null` : sql`nothing`}
      returning id, job_id, attempts
    `);
    const skipped = chosen.length - rows.rows.length;
    console.log(`\n${run}: ${rows.rows.length} rows claimed${skipped ? `, ${skipped} already had a match row and were left alone` : ""}`);
    const lines = await scoreClaimed(db, profile, rows.rows.map((r) => ({ id: r.id, jobId: r.job_id, attempts: r.attempts, via: "new" as const })), { run, order: "profile-first" });
    const ok = lines.filter((l) => l.ok);
    console.log(`scored ${ok.length}, failed ${lines.length - ok.length}, usd ${lines.reduce((a, l) => a + l.usd, 0).toFixed(4)}, max cached tokens ${Math.max(0, ...lines.map((l) => l.tokensCached))}`);
    for (const l of lines.filter((x) => !x.ok)) console.log(`  failed ${l.jobId}: ${l.error}`);
  }

  if (only !== "prefix") {
    const run = `${tag}-nocache`;
    const jobsById = await loadScoringJobs(db, chosen);
    let usd = 0;
    let failed = 0;
    let cached = 0;
    let next = 0;
    const worker = async () => {
      for (;;) {
        const id = chosen[next++];
        if (!id) return;
        const job = jobsById.get(id);
        if (!job) continue;
        try {
          const r = await scoreJob(profile.block, job, { order: "job-first" });
          usd += r.usd;
          cached = Math.max(cached, r.usage.cachedInputTokens);
          await db.insert(costEvents).values({ kind: "score", model: r.model, userId, refId: id, tokensIn: r.usage.inputTokens, tokensCached: r.usage.cachedInputTokens, tokensOut: r.usage.outputTokens, usd: r.usd, ms: r.ms, run });
        } catch (e) {
          failed += 1;
          if (e instanceof ScoreError && e.usage) {
            usd += e.usd;
            await db.insert(costEvents).values({ kind: "score", model: e.model, userId, refId: id, tokensIn: e.usage.inputTokens, tokensCached: e.usage.cachedInputTokens, tokensOut: e.usage.outputTokens, usd: e.usd, ms: e.ms, run });
          }
          console.log(`  failed ${id}: ${e instanceof Error ? e.message : String(e)}`);
        }
      }
    };
    await Promise.all(Array.from({ length: 5 }, worker));
    console.log(`\n${run}: scored ${chosen.length - failed}, failed ${failed}, usd ${usd.toFixed(4)}, max cached tokens ${cached}`);
  }

  console.log("\ncost per scoring call by run, USD");
  console.table(await runStats(db));
  for (const by of ["family", "length", "seniority"] as const) {
    console.log(`by ${by}`);
    console.table((await cellStats(db, by)).filter((c) => c.run.startsWith(tag)));
  }
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
