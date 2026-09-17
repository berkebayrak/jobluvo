import { sql } from "drizzle-orm";
import { dbHttp } from "@/db/client";
import type { JobLocation } from "@/db/schema";

/**
 * One card per open job or group. Groups are read through job_group_links;
 * a grouped job shows only when it is the group's canonical member. Swipes
 * and closures are live conditions, never stored filter results.
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

export async function feedForUser(userId: string, limit = 200): Promise<FeedJob[]> {
  const res = await dbHttp().execute<Record<string, unknown>>(sql`
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
    from jobs j
    left join job_group_links l on l.job_id = j.id
    left join job_groups g on g.id = l.group_id
    where j.closed_at is null
      and not j.detail_pending
      and (l.job_id is null or g.canonical_job_id = j.id)
      and not exists (select 1 from swipe_decisions s where s.user_id = ${userId} and s.job_id = j.id)
    order by coalesce(j.posted_at, j.first_seen_at) desc
    limit ${limit}
  `);
  return res.rows.map((r) => ({
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
  }));
}
