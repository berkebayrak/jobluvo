import { sql } from "drizzle-orm";
import type { DbPool, Tx } from "@/db/client";
import { UNKNOWN_COST_MARK } from "@/server/llm/client";

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

export interface CitationStats {
  run: string;
  packets: number;
  edits: number;
  citedEdits: number;
  /** Edits whose cited facts do not carry a value the edit uses. */
  wrongCitations: number;
  /** Per 100 cited edits. */
  ratePer100: number;
}

/**
 * How often the model points at the wrong supporting fact, from the packets
 * on hand, by the run that wrote them. A packet is one row per user and
 * job, so a later run over the same jobs replaces the earlier rows; the
 * decision log keeps each sample's rate as it was measured.
 */
export async function citationStats(db: DbPool | Tx): Promise<CitationStats[]> {
  const r = await db.execute<Record<string, unknown>>(sql`
    with edits as (
      select coalesce(p.run, 'product') as run, p.id, e
      from packets p, jsonb_array_elements(p.changes) e
    ),
    wrong as (
      select coalesce(p.run, 'product') as run, p.id, f->>'bullet' as bullet
      from packets p, jsonb_array_elements(p.findings) f
      where f->>'message' = 'value is on the profile but not in the cited facts'
    )
    select run,
      (select count(*)::int from packets p where coalesce(p.run, 'product') = e.run) as packets,
      count(*)::int as edits,
      count(*) filter (where jsonb_array_length(e->'facts') > 0)::int as cited,
      (select count(distinct (id, bullet))::int from wrong w where w.run = e.run) as wrong
    from edits e group by run order by run
  `);
  return r.rows.map((x) => {
    const cited = num(x.cited);
    const wrong = num(x.wrong);
    return {
      run: String(x.run),
      packets: num(x.packets),
      edits: num(x.edits),
      citedEdits: cited,
      wrongCitations: wrong,
      ratePer100: cited ? Number(((100 * wrong) / cited).toFixed(2)) : 0,
    };
  });
}

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

/*
 * Calls of unknown cost: a timeout or a lost connection returns no usage,
 * so nothing reaches cost_events and the only trace is the message on the
 * match or packet row (UNKNOWN_COST_MARK). A row counts once, whatever its
 * attempts, so this is a floor on the calls and the worst case prices each
 * row at the kind's mean cost per call, beside the recorded spend. It is
 * the counter for the timeout budgets in D-015: a rising count says the
 * margin over the observed max was wrong. The floor depends on the mark
 * surviving the store: matches.error keeps the raw message, and
 * packets.error is assembled by `storedError` in packet/run.ts so the last
 * attempt's message is never truncated away behind an earlier attempt's
 * text. Whoever changes either error text changes what this counts.
 * Extraction stores no error text
 * on a row yet, so its unknown calls are not countable until the document
 * gets a status column (review finding 5, item 9).
 */
export interface UnknownCostStats {
  kind: string;
  unknownRows: number | null;
  usdMeanPerCall: number;
  usdWorstCase: number | null;
  usdRecorded: number;
  note: string;
}

export async function unknownCostStats(db: DbPool | Tx): Promise<UnknownCostStats[]> {
  const like = `%${UNKNOWN_COST_MARK}%`;
  const r = await db.execute<Record<string, unknown>>(sql`
    with k as (
      select kind::text as kind, avg(usd) as mean, sum(usd) as total
      from cost_events where kind in ('score', 'tailor', 'extract') group by 1
    ), u as (
      select 'score' as kind, count(*)::int as n from matches where error like ${like}
      union all
      select 'tailor' as kind, count(*)::int as n from packets where error like ${like}
    )
    select k.kind, u.n, k.mean, k.total from k left join u on u.kind = k.kind order by 1
  `);
  return r.rows.map((x) => {
    const n = x.n === null || x.n === undefined ? null : num(x.n);
    const mean = num(x.mean);
    return {
      kind: String(x.kind),
      unknownRows: n,
      usdMeanPerCall: Number(mean.toFixed(6)),
      usdWorstCase: n === null ? null : Number((n * mean).toFixed(4)),
      usdRecorded: Number(num(x.total).toFixed(4)),
      note: n === null ? "not countable: no error text stored per document" : "rows whose latest attempt timed out or lost the connection",
    };
  });
}
