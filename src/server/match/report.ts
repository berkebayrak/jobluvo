import { sql } from "drizzle-orm";
import type { DbPool, Tx } from "@/db/client";
import { UNKNOWN_COST_MARK } from "@/server/llm/client";
import { STALE_CLAIM_MINUTES } from "@/server/match/claim";
import { PROCESSING_STALE_MS } from "@/server/profile/confirm";
import { CITATION_KIND, type CitationKind, type FindingCode } from "@/server/packet/codes";

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
  /** The denominator: bullet edits that cite at least one fact. Every numerator below counts the same thing, a cited bullet edit. */
  citedEdits: number;
  /** Cited bullet edits with a finding of each kind. A line with two findings of one kind counts once; a line with two kinds counts in both. */
  numericSupport: number;
  unsupportedResponsibility: number;
  missingCitation: number;
  wrongRole: number;
  /** Cited bullet edits with at least one citation failure of any kind. Not the sum of the four: one line can fail in two ways. */
  anyKind: number;
  /** `anyKind` per 100 cited edits. */
  ratePer100: number;
  /** Cited bullet edits whose findings carry no code this build knows, which would otherwise be counted as zero of everything. */
  unrecognised: number;
  /** Of the packets, those the run kept on their first attempt, and those on a retry. A retried packet's numbers are the retained attempt's. */
  packetsFirstAttempt: number;
  packetsRetried: number;
}

/**
 * How often a line is not supported by what it cites, from the packets on
 * hand, by the run that wrote them, split by the four ways it happens
 * (review four, finding 17).
 *
 * Three things this fixes, all of which made the old single number wrong
 * rather than merely coarse.
 *
 * 1. It counted one finding, matched by its prose in SQL, and called the
 *    result "wrong citations". Every review level citation failure, a
 *    responsibility the cited facts do not carry, a missing citation, a
 *    fact from another role, was absent from the numerator. The number was
 *    a fraction of the problem presented as the whole of it, and the day
 *    that sentence is reworded it reads zero.
 * 2. Numerator and denominator counted different things. The numerator
 *    counted distinct (packet, bullet) pairs from the findings, which
 *    includes a finding on the summary; the denominator counted cited
 *    entries of `changes`, which never contains the summary. A rate over
 *    two different units is not a rate.
 * 3. Nothing said which attempt the packets were. A retried packet's
 *    findings are the retained attempt's, and a run with many retries is
 *    not comparable to one without, so the split is reported beside it.
 *
 * A packet is one row per user and job, so a later run over the same jobs
 * replaces the earlier rows; the decision log keeps each sample's rate as
 * it was measured.
 */
export async function citationStats(db: DbPool | Tx): Promise<CitationStats[]> {
  // The codes of each kind, sent to the query as lists, so the SQL never names a message.
  // A list of codes as an IN list. Interpolating a JavaScript array gives a parameter tuple, which `any()` cannot read.
  const list = (codes: string[]) => sql.join(codes.map((c) => sql`${c}`), sql`, `);
  const of = (kind: CitationKind) => list((Object.keys(CITATION_KIND) as FindingCode[]).filter((c) => CITATION_KIND[c] === kind));
  const known = list(Object.keys(CITATION_KIND));
  const r = await db.execute<Record<string, unknown>>(sql`
    with edits as (
      select coalesce(p.run, 'product') as run, p.id, e->>'bullet' as bullet
      from packets p, jsonb_array_elements(p.changes) e
      where jsonb_array_length(e->'facts') > 0
    ),
    all_edits as (
      select coalesce(p.run, 'product') as run, count(*)::int as n
      from packets p, jsonb_array_elements(p.changes) e group by 1
    ),
    -- Only findings on a bullet that is itself a cited edit: same unit above and below the line.
    f as (
      select e.run, e.id, e.bullet, fi->>'code' as code
      from edits e
      join packets p on p.id = e.id
      cross join lateral jsonb_array_elements(p.findings) fi
      where fi->>'bullet' = e.bullet
    ),
    counted as (
      select run,
        count(distinct (id, bullet)) filter (where code in (${of("numeric support")}))            as numeric_support,
        count(distinct (id, bullet)) filter (where code in (${of("unsupported responsibility")})) as unsupported_responsibility,
        count(distinct (id, bullet)) filter (where code in (${of("missing citation")}))           as missing_citation,
        count(distinct (id, bullet)) filter (where code in (${of("wrong role")}))                 as wrong_role,
        count(distinct (id, bullet)) filter (where code in (${known}))                            as any_kind,
        count(distinct (id, bullet)) filter (where code is null)                                    as unrecognised
      from f group by run
    )
    select e.run,
      (select count(*)::int from packets p where coalesce(p.run, 'product') = e.run) as packets,
      (select count(*)::int from packets p where coalesce(p.run, 'product') = e.run and coalesce(p.attempt, 1) = 1) as packets_first,
      (select count(*)::int from packets p where coalesce(p.run, 'product') = e.run and p.attempt > 1) as packets_retried,
      (select n from all_edits a where a.run = e.run) as edits,
      count(*)::int as cited,
      coalesce((select numeric_support from counted c where c.run = e.run), 0)::int as numeric_support,
      coalesce((select unsupported_responsibility from counted c where c.run = e.run), 0)::int as unsupported_responsibility,
      coalesce((select missing_citation from counted c where c.run = e.run), 0)::int as missing_citation,
      coalesce((select wrong_role from counted c where c.run = e.run), 0)::int as wrong_role,
      coalesce((select any_kind from counted c where c.run = e.run), 0)::int as any_kind,
      coalesce((select unrecognised from counted c where c.run = e.run), 0)::int as unrecognised
    from edits e group by e.run order by e.run
  `);
  return r.rows.map((x) => {
    const cited = num(x.cited);
    const any = num(x.any_kind);
    return {
      run: String(x.run),
      packets: num(x.packets),
      edits: num(x.edits),
      citedEdits: cited,
      numericSupport: num(x.numeric_support),
      unsupportedResponsibility: num(x.unsupported_responsibility),
      missingCitation: num(x.missing_citation),
      wrongRole: num(x.wrong_role),
      anyKind: any,
      ratePer100: cited ? Number(((100 * any) / cited).toFixed(2)) : 0,
      unrecognised: num(x.unrecognised),
      packetsFirstAttempt: num(x.packets_first),
      packetsRetried: num(x.packets_retried),
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
 * match, packet or document row (UNKNOWN_COST_MARK). A row counts once,
 * whatever its attempts, so this is a floor on the calls, and the worst
 * case prices each row at the kind's mean cost per call, beside the
 * recorded spend. It is the counter for the timeout budgets in D-015: a
 * rising count says the margin over the observed max was wrong.
 *
 * The floor depends on the mark surviving the store: matches.error keeps
 * the raw message, packets.error is assembled by `storedError` in
 * packet/run.ts so the last attempt's message is never truncated away
 * behind an earlier attempt's text, and profile_documents.error keeps the
 * raw message of a failed extraction. Whoever changes any of the three
 * changes what this counts.
 *
 * A killed function is the other way a paid call leaves no row, and no
 * catch runs, so no mark is written. What each kind leaves behind, read
 * from the code on 17 Sep 2026:
 *
 *   extract  the document stays `processing` with a null error. The view
 *            reads one older than PROCESSING_STALE_MS as failed; the same
 *            constant counts it here as `staleRows`, its own column,
 *            because a marked error is a call that timed out and a stale
 *            row is a function that died, different problems.
 *   score    the claim sets the row `pending` with claimed_at, and the
 *            scoring writes scored or failed afterwards, so a kill mid
 *            call leaves `pending` with a null error. The claim reclaims
 *            it after STALE_CLAIM_MINUTES while attempts are under the
 *            cap, so it is visible here only until then, counted as
 *            `staleRows` from the same constant; after the reclaim the
 *            only trace is attempts plus one, which a failed retry also
 *            leaves, and at the cap the row stays pending for good and
 *            stays in this count (review finding 11 D).
 *   tailor   the packet row is written after the loop and the cost row
 *            after each call, so a kill mid call leaves nothing at all:
 *            not countable until the attempt history table (D-016).
 */
export interface UnknownCostStats {
  kind: string;
  unknownRows: number | null;
  /** Rows a killed function left behind with no error text: a processing document or a pending match older than its stale window. Null where nothing is left to count. */
  staleRows: number | null;
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
      select 'score' as kind, count(*) filter (where error like ${like})::int as n,
        count(*) filter (where status = 'pending' and error is null and claimed_at < now() - make_interval(mins => ${STALE_CLAIM_MINUTES}))::int as stale
      from matches where error like ${like} or status = 'pending'
      union all
      select 'tailor' as kind, count(*)::int as n, null::int as stale from packets where error like ${like}
      union all
      select 'extract' as kind, count(*) filter (where error like ${like})::int as n,
        count(*) filter (where status = 'processing' and error is null and uploaded_at < now() - make_interval(secs => ${PROCESSING_STALE_MS / 1000}))::int as stale
      from profile_documents where error like ${like} or status = 'processing'
    )
    select k.kind, u.n, u.stale, k.mean, k.total from k left join u on u.kind = k.kind order by 1
  `);
  return r.rows.map((x) => {
    const n = x.n === null || x.n === undefined ? null : num(x.n);
    const stale = x.stale === null || x.stale === undefined ? null : num(x.stale);
    const mean = num(x.mean);
    const notes: Record<string, string> = {
      score: "marked: timed out or lost the connection; stale: pending past the reclaim window, a killed cron, gone from here once reclaimed",
      tailor: "marked: timed out or lost the connection; a killed function leaves no row, not countable until the attempt history",
      extract: "marked: timed out or lost the connection; stale: processing past the view's window, a killed upload function",
    };
    return {
      kind: String(x.kind),
      unknownRows: n,
      staleRows: stale,
      usdMeanPerCall: Number(mean.toFixed(6)),
      usdWorstCase: n === null ? null : Number(((n + (stale ?? 0)) * mean).toFixed(4)),
      usdRecorded: Number(num(x.total).toFixed(4)),
      note: notes[String(x.kind)] ?? "",
    };
  });
}
