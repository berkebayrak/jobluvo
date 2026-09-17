import { sql } from "drizzle-orm";
import type { DbPool, Tx } from "@/db/client";

/*
 * The cost per model call, as a distribution, from cost_events. One block
 * per kind and run tag; a null run is the product path (the cron for
 * scoring). The mean is printed beside the percentiles
 * because the budget is a mean, but the percentiles are the finding (D-003).
 * Dollars are USD per call at the prices in src/server/llm/prices.ts.
 */

export interface RunStats {
  kind: string;
  run: string;
  calls: number;
  model: string | null;
  tokensInP50: number;
  tokensCachedP50: number;
  tokensOutP50: number;
  cachedShare: number;
  usdP10: number;
  usdP50: number;
  usdP90: number;
  usdMean: number;
  usdMax: number;
  usdTotal: number;
}

export interface CellStats {
  kind: string;
  run: string;
  cell: string;
  calls: number;
  tokensInP50: number;
  usdP50: number;
  usdMean: number;
}

const num = (v: unknown) => Number(v ?? 0);

export async function runStats(db: DbPool | Tx): Promise<RunStats[]> {
  const r = await db.execute<Record<string, unknown>>(sql`
    select kind::text as kind, coalesce(run, 'cron') as run, count(*)::int as calls, min(model) as model,
      percentile_cont(0.5) within group (order by tokens_in) as in_p50,
      percentile_cont(0.5) within group (order by tokens_cached) as cached_p50,
      percentile_cont(0.5) within group (order by tokens_out) as out_p50,
      case when sum(tokens_in) = 0 then 0 else sum(tokens_cached)::float / sum(tokens_in) end as cached_share,
      percentile_cont(0.1) within group (order by usd) as p10,
      percentile_cont(0.5) within group (order by usd) as p50,
      percentile_cont(0.9) within group (order by usd) as p90,
      avg(usd) as mean, max(usd) as max, sum(usd) as total
    from cost_events where kind in ('score', 'tailor', 'extract')
    group by 1, 2 order by 1, 2
  `);
  return r.rows.map((x) => ({
    kind: String(x.kind),
    run: String(x.run),
    calls: num(x.calls),
    model: (x.model as string | null) ?? null,
    tokensInP50: Math.round(num(x.in_p50)),
    tokensCachedP50: Math.round(num(x.cached_p50)),
    tokensOutP50: Math.round(num(x.out_p50)),
    cachedShare: Number(num(x.cached_share).toFixed(3)),
    usdP10: Number(num(x.p10).toFixed(6)),
    usdP50: Number(num(x.p50).toFixed(6)),
    usdP90: Number(num(x.p90).toFixed(6)),
    usdMean: Number(num(x.mean).toFixed(6)),
    usdMax: Number(num(x.max).toFixed(6)),
    usdTotal: Number(num(x.total).toFixed(4)),
  }));
}

/**
 * The same, split by family, seniority or description length. ref_id is a
 * match id for the scoring cron and the prefix sample, and a job id for the
 * sample's other order and for every tailoring row.
 */
export async function cellStats(db: DbPool | Tx, by: "family" | "length" | "seniority"): Promise<CellStats[]> {
  const cell =
    by === "family"
      ? sql`j.family::text`
      : by === "seniority"
        ? sql`coalesce(j.seniority, 'not stated')`
        : sql`case when length(j.description_core) < 2500 then 'short <2.5k' when length(j.description_core) < 5000 then 'medium 2.5k to 5k' else 'long 5k+' end`;
  const r = await db.execute<Record<string, unknown>>(sql`
    select c.kind::text as kind, coalesce(c.run, 'cron') as run, ${cell} as cell, count(*)::int as calls,
      percentile_cont(0.5) within group (order by c.tokens_in) as in_p50,
      percentile_cont(0.5) within group (order by c.usd) as p50, avg(c.usd) as mean
    from cost_events c
    left join matches m on c.ref_id ~ '^[0-9a-f-]{36}$' and m.id = c.ref_id::uuid
    join jobs j on j.id = coalesce(m.job_id, case when c.ref_id ~ '^[0-9a-f-]{36}$' then c.ref_id::uuid end)
    where c.kind in ('score', 'tailor')
    group by 1, 2, 3 order by 1, 2, 3
  `);
  return r.rows.map((x) => ({
    kind: String(x.kind),
    run: String(x.run),
    cell: String(x.cell),
    calls: num(x.calls),
    tokensInP50: Math.round(num(x.in_p50)),
    usdP50: Number(num(x.p50).toFixed(6)),
    usdMean: Number(num(x.mean).toFixed(6)),
  }));
}
