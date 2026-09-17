import { sql, type SQL } from "drizzle-orm";
import { dbHttp } from "@/db/client";
import type { JobLocation } from "@/db/schema";
import { hardFilterSql, type FilterFacts } from "@/server/match/hardFilter";

/**
 * The job feed for one user: one card per dedupe group, the canonical job
 * being the earliest open member; closed jobs, jobs still waiting for a
 * SmartRecruiters detail, and jobs the user has swiped are excluded as live
 * conditions, so Undo brings a job straight back.
 *
 * The hard filter is applied here, before anything is ranked or shown
 * (JOB-06). Jobs it hides are counted by reason so the page can say how many
 * the profile keeps out, rather than silently showing fewer.
 *
 * Filtering and paging happen here, not on the client. The page shows the
 * inventory's real size and company count, every filter option that exists
 * in the inventory, and a page of rows it can extend, so no number on screen
 * is the size of a window.
 */

export interface FeedJob {
  id: string;
  groupId: string | null;
  family: string;
  companyName: string;
  companyDomain: string | null;
  title: string;
  locations: JobLocation[];
  workplace: string;
  employmentType: string | null;
  compMin: number | null;
  compMax: number | null;
  compCurrency: string | null;
  compPeriod: string;
  seniority: string | null;
  sponsorship: string;
  sponsorshipEvidence: string | null;
  eligibility: string | null;
  eligibilityEvidence: string | null;
  applyUrl: string;
  postedAt: string | null;
  firstSeenAt: string;
  /** Families this job is also listed on, through its group. */
  alsoOn: string[];
  copies: number;
}

export interface FeedFilters {
  /** Free text over title, company and the raw location strings. */
  q?: string;
  /** Posted or first seen within this many hours. */
  hours?: number;
  /** Location labels as the facet lists them. */
  loc?: string[];
  workplace?: string[];
  co?: string[];
  level?: string[];
  /** Only postings that say they sponsor. */
  sponsor?: boolean;
  /** A job matching any of these words in title, company or location drops out. */
  exclude?: string[];
}

export interface FeedPage {
  jobs: FeedJob[];
  offset: number;
  limit: number;
  /** Jobs matching the chips, across the whole inventory. */
  total: number;
  /** The inventory before any chip: open jobs that pass the user's hard filter. */
  inventory: { jobs: number; companies: number };
  /** Open jobs the hard filter keeps out, by first failing reason. Empty with no profile. */
  hidden: { total: number; reasons: Record<string, number> };
  /** Every value present in the inventory, so an option always matches something. */
  facets: { loc: string[]; workplace: string[]; co: string[]; level: string[] };
}

export const FEED_PAGE = 200;

/**
 * The label the card shows for the first location. Mirrored by
 * `locationLabel` in src/lib/app/jobs-client.ts; the facet and the filter use
 * this one so an option always finds its rows.
 */
const LOCATION_LABEL = sql`case
  when jsonb_array_length(j.locations) = 0 then 'Not stated'
  when (j.locations->0->>'remote')::boolean is true and j.locations->0->>'city' is null
    then coalesce('Remote, ' || (j.locations->0->>'country'), 'Remote')
  else coalesce(nullif(concat_ws(', ', j.locations->0->>'city', coalesce(j.locations->0->>'region', j.locations->0->>'country')), ''), j.locations->0->>'raw')
  end`;

const textList = (xs: string[]) => sql.join(xs.map((x) => sql`${x}`), sql`, `);

/** Open, visible to the user: not closed, not waiting for a detail, canonical, not swiped. */
function visibleWhere(userId: string): SQL {
  return sql`j.closed_at is null
    and not j.detail_pending
    and (l.job_id is null or g.canonical_job_id = j.id)
    and not exists (select 1 from swipe_decisions s where s.user_id = ${userId} and s.job_id = j.id)`;
}

function chipsWhere(f: FeedFilters): SQL[] {
  const parts: SQL[] = [];
  const hay = (word: string) => {
    const like = `%${word}%`;
    return sql`(j.title ilike ${like} or j.company_name ilike ${like}
      or exists (select 1 from jsonb_array_elements(j.locations) x where x->>'raw' ilike ${like}))`;
  };
  if (f.q?.trim()) parts.push(hay(f.q.trim()));
  if (f.hours) parts.push(sql`coalesce(j.posted_at, j.first_seen_at) >= now() - make_interval(hours => ${f.hours})`);
  if (f.loc?.length) parts.push(sql`(${LOCATION_LABEL}) in (${textList(f.loc)})`);
  if (f.workplace?.length) parts.push(sql`j.workplace::text in (${textList(f.workplace)})`);
  if (f.co?.length) parts.push(sql`j.company_name in (${textList(f.co)})`);
  if (f.level?.length) parts.push(sql`j.seniority in (${textList(f.level)})`);
  if (f.sponsor) parts.push(sql`j.sponsorship = 'offered'`);
  for (const w of f.exclude ?? []) if (w.trim()) parts.push(sql`not ${hay(w.trim())}`);
  return parts;
}

const FROM = sql`from jobs j
  left join job_group_links l on l.job_id = j.id
  left join job_groups g on g.id = l.group_id`;

export async function feedForUser(
  userId: string,
  opts: { limit?: number; offset?: number; filters?: FeedFilters; facts?: FilterFacts | null } = {},
): Promise<FeedPage> {
  const limit = Math.min(Math.max(opts.limit ?? FEED_PAGE, 1), 500);
  const offset = Math.max(opts.offset ?? 0, 0);
  const db = dbHttp();

  const visible = visibleWhere(userId);
  const reason = opts.facts ? hardFilterSql(opts.facts) : null;
  const passes: SQL = reason ? sql`(${reason}) is null` : sql`true`;
  const inventoryWhere = sql`${visible} and ${passes}`;
  const where = sql.join([inventoryWhere, ...chipsWhere(opts.filters ?? {})], sql` and `);

  const [page, counts, facets, hidden] = await Promise.all([
    db.execute<Record<string, unknown>>(sql`
      select
        j.id, l.group_id, j.family, j.company_name, j.company_domain, j.title, j.locations, j.workplace,
        j.employment_type, j.comp_min, j.comp_max, j.comp_currency, j.comp_period, j.seniority, j.sponsorship,
        j.sponsorship_evidence, j.eligibility, j.eligibility_evidence,
        j.apply_url, j.posted_at, j.first_seen_at,
        coalesce((
          select array_agg(distinct o.family::text) from job_group_links l2 join jobs o on o.id = l2.job_id
          where l2.group_id = l.group_id and o.id <> j.id and o.closed_at is null
        ), '{}') as also_on,
        coalesce((select count(*) from job_group_links l3 where l3.group_id = l.group_id), 1) as copies
      ${FROM}
      where ${where}
      order by coalesce(j.posted_at, j.first_seen_at) desc, j.id
      limit ${limit} offset ${offset}
    `),
    db.execute<{ total: number; inventory_jobs: number; inventory_companies: number }>(sql`
      select
        (select count(*)::int ${FROM} where ${where}) as total,
        (select count(*)::int ${FROM} where ${inventoryWhere}) as inventory_jobs,
        (select count(distinct j.company_name)::int ${FROM} where ${inventoryWhere}) as inventory_companies
    `),
    db.execute<{ kind: string; value: string }>(sql`
      select distinct 'loc' as kind, (${LOCATION_LABEL}) as value ${FROM} where ${inventoryWhere}
      union
      select distinct 'workplace', j.workplace::text ${FROM} where ${inventoryWhere}
      union
      select distinct 'co', j.company_name ${FROM} where ${inventoryWhere}
      union
      select distinct 'level', j.seniority ${FROM} where ${inventoryWhere} and j.seniority is not null
      order by 1, 2
    `),
    reason
      ? db.execute<{ reason: string; n: number }>(sql`
          select (${reason}) as reason, count(*)::int as n ${FROM} where ${visible} and (${reason}) is not null group by 1 order by 2 desc
        `)
      : Promise.resolve({ rows: [] as { reason: string; n: number }[] }),
  ]);

  const c = counts.rows[0];
  const facet = (kind: string) => facets.rows.filter((r) => r.kind === kind).map((r) => r.value);
  const reasons: Record<string, number> = {};
  for (const r of hidden.rows) reasons[r.reason] = Number(r.n);
  return {
    jobs: page.rows.map(rowToJob),
    offset,
    limit,
    total: Number(c?.total ?? 0),
    inventory: { jobs: Number(c?.inventory_jobs ?? 0), companies: Number(c?.inventory_companies ?? 0) },
    hidden: { total: Object.values(reasons).reduce((a, b) => a + b, 0), reasons },
    facets: { loc: facet("loc"), workplace: facet("workplace"), co: facet("co"), level: facet("level") },
  };
}

function rowToJob(r: Record<string, unknown>): FeedJob {
  return {
    id: r.id as string,
    groupId: (r.group_id as string | null) ?? null,
    family: r.family as string,
    companyName: r.company_name as string,
    companyDomain: (r.company_domain as string | null) ?? null,
    title: r.title as string,
    locations: (r.locations as JobLocation[]) ?? [],
    workplace: r.workplace as string,
    employmentType: (r.employment_type as string | null) ?? null,
    compMin: (r.comp_min as number | null) ?? null,
    compMax: (r.comp_max as number | null) ?? null,
    compCurrency: (r.comp_currency as string | null) ?? null,
    compPeriod: r.comp_period as string,
    seniority: (r.seniority as string | null) ?? null,
    sponsorship: r.sponsorship as string,
    sponsorshipEvidence: (r.sponsorship_evidence as string | null) ?? null,
    eligibility: (r.eligibility as string | null) ?? null,
    eligibilityEvidence: (r.eligibility_evidence as string | null) ?? null,
    applyUrl: r.apply_url as string,
    postedAt: r.posted_at ? new Date(r.posted_at as string).toISOString() : null,
    firstSeenAt: new Date(r.first_seen_at as string).toISOString(),
    alsoOn: (r.also_on as string[]) ?? [],
    copies: Number(r.copies ?? 1),
  };
}
