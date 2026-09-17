import { sql, type SQL } from "drizzle-orm";
import type { DbPool, Tx } from "@/db/client";
import { withRep } from "@/server/jobs/feed";
import { hardFilterSql, type FilterFacts } from "@/server/match/hardFilter";

/*
 * The scoring claim, two statements, each safe against a second cron
 * running at the same time.
 *
 * 1. New pairs. An INSERT ... SELECT over this user's feed representatives
 *    that pass the hard filter and were first seen in the last 24 hours,
 *    ON CONFLICT DO NOTHING on (user_id, job_id). The backlog is never
 *    claimed here: an old job is scored only if it reaches step 2 by
 *    already having a row (D-004).
 *
 * 2. Rework. An UPDATE over rows locked with FOR UPDATE SKIP LOCKED, so two
 *    crons split the rows rather than double score them. Rework rows are:
 *    failed with fewer than 3 attempts; pending with a claim older than the
 *    function ceiling, which is what a killed function leaves behind, under
 *    the same cap; and scored rows whose prefs_hash, facts_hash or the
 *    job's content_hash moved. A retry increments attempts, so a pair that
 *    failed three times stays failed and takes no slot. A rescore of moved
 *    content starts the count again at 1, because it is a new score of new
 *    input, not another try at the same one.
 *
 * Both steps together fill one batch. The hard filter is `hardFilterSql`
 * from the feed; there is no second copy of it.
 */

export const MAX_ATTEMPTS = 3;
export const STALE_CLAIM_MINUTES = 10;
export const FRESH_HOURS = 24;

export interface ClaimKeys {
  userId: string;
  facts: FilterFacts;
  prefsHash: string;
  factsHash: string;
}

export interface ClaimedRow {
  id: string;
  jobId: string;
  attempts: number;
  /** "new" from step 1, "rework" from step 2. */
  via: "new" | "rework";
}

export async function claimMatches(db: DbPool | Tx, keys: ClaimKeys, batch: number): Promise<ClaimedRow[]> {
  const out: ClaimedRow[] = [];
  const reason: SQL = hardFilterSql(keys.facts);
  const fresh = await db.execute<{ id: string; job_id: string; attempts: number }>(sql`
    ${withRep(keys.userId, reason)}
    insert into matches (user_id, job_id, prefs_hash, facts_hash, content_hash, status, attempts, claimed_at)
    select ${keys.userId}, j.id, ${keys.prefsHash}, ${keys.factsHash}, j.content_hash, 'pending', 1, now()
    from rep join jobs j on j.id = rep.id
    where rep.reason is null
      and j.first_seen_at >= now() - make_interval(hours => ${FRESH_HOURS})
      and not exists (select 1 from matches m where m.user_id = ${keys.userId} and m.job_id = j.id)
    order by j.first_seen_at desc, j.id
    limit ${batch}
    on conflict (user_id, job_id) do nothing
    returning id, job_id, attempts
  `);
  for (const r of fresh.rows) out.push({ id: r.id, jobId: r.job_id, attempts: r.attempts, via: "new" });

  const remaining = batch - out.length;
  if (remaining <= 0) return out;
  const rework = await db.execute<{ id: string; job_id: string; attempts: number }>(sql`
    update matches m
    set status = 'pending',
        attempts = case when m.status = 'scored' then 1 else m.attempts + 1 end,
        claimed_at = now(),
        updated_at = now(),
        prefs_hash = ${keys.prefsHash},
        facts_hash = ${keys.factsHash},
        content_hash = j.content_hash,
        error = null
    from jobs j
    where j.id = m.job_id and m.id in (
      select m2.id
      from matches m2 join jobs j2 on j2.id = m2.job_id
      where m2.user_id = ${keys.userId}
        and j2.closed_at is null
        and (
          (m2.status = 'failed' and m2.attempts < ${MAX_ATTEMPTS})
          or (m2.status = 'pending' and m2.attempts < ${MAX_ATTEMPTS}
              and m2.claimed_at < now() - make_interval(mins => ${STALE_CLAIM_MINUTES}))
          or (m2.status = 'scored'
              and (m2.prefs_hash <> ${keys.prefsHash} or m2.facts_hash <> ${keys.factsHash} or m2.content_hash <> j2.content_hash))
        )
      order by m2.claimed_at, m2.id
      limit ${remaining}
      for update of m2 skip locked
    )
    returning m.id, m.job_id, m.attempts
  `);
  for (const r of rework.rows) out.push({ id: r.id, jobId: r.job_id, attempts: r.attempts, via: "rework" });
  return out;
}
