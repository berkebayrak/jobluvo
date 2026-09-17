import { and, eq, inArray, sql } from "drizzle-orm";
import type { Tx } from "@/db/client";
import { jobGroupLinks, jobGroups, jobs, similarityLog, type Job, type JobLocation } from "@/db/schema";
import { env } from "@/lib/env";

/*
 * Job identity. Four ways two rows can be the same posting, tried in order:
 * the row key itself, the normalised apply URL, the requisition id, and a
 * similarity test on the boilerplate free description. A job belongs to at
 * most one group; job_group_links is the only record of membership.
 *
 * Linking is set based: one query per rule over all the jobs that changed in
 * a poll, not one query per job. Group creation is per link, which is rare.
 */

/*
 * Query parameters that identify a job. Everything else is dropped:
 * tracking, language, source and whatever a board adds next. An allowlist,
 * on purpose. A denylist failed twice on the first live run: it stripped
 * gh_jid, the only thing that tells two postings apart on boards that embed
 * the Greenhouse form in the employer's own site, such as
 * careers.airbnb.com/positions/123?gh_jid=123, and it kept lang=en, which
 * made the same job in two languages two jobs.
 *
 * Keyed on the parameter name, not on the family of the source that saw the
 * URL. gh_jid only ever appears on a Greenhouse embedded page, whichever
 * board handed us the link, so it is kept wherever it appears. Keyed on the
 * source family it was dropped for a copy arriving through any other family,
 * which would have collapsed every Stripe job seen from a syndicated board
 * into https://stripe.com/jobs/search, the same failure as the denylist.
 * Add a key here when a family turns out to need it.
 */
const IDENTIFYING_PARAMS: ReadonlySet<string> = new Set(["gh_jid"]);

/**
 * Lowercase host, only the identifying parameters kept, no fragment, no
 * trailing slash, remaining query keys sorted. Two syndicated copies that
 * point at the employer's own page meet here.
 */
export function normaliseApplyUrl(raw: string): string {
  let u: URL;
  try {
    u = new URL(raw.trim());
  } catch {
    return raw.trim().toLowerCase();
  }
  u.protocol = "https:";
  u.hostname = u.hostname.toLowerCase().replace(/^www\./, "");
  u.hash = "";
  const kept: [string, string][] = [];
  for (const [k, v] of u.searchParams) {
    const key = k.toLowerCase();
    if (!IDENTIFYING_PARAMS.has(key)) continue;
    kept.push([key, v]);
  }
  kept.sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  u.search = kept.length ? "?" + kept.map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join("&") : "";
  let path = u.pathname.replace(/\/+$/, "");
  if (path === "") path = "/";
  u.pathname = path;
  return u.toString().replace(/\/$/, "");
}

/** The advisory lock key for one employer, so every dedupe path serialises on the same lock. */
export function lockKey(s: { companyDomain: string | null; family: string; tenant: string }): string {
  return s.companyDomain ?? `${s.family}|${s.tenant}`;
}

/**
 * Serialises every dedupe path for one employer across connections. Taken
 * once per source poll, before any upsert.
 *
 * This is pg_advisory_xact_lock, the transaction scoped variant, on purpose.
 * The app reaches Neon through its pooler in transaction mode, where a
 * session scoped pg_advisory_lock would be released or leak whenever the
 * pooler hands the connection to someone else. The xact variant lives and
 * dies with the transaction, which is exactly the span we need. Keying on
 * the employer rather than employer plus title matters too: a URL or
 * requisition match between "Sr. PM" and "Senior Product Manager" would
 * otherwise take two different locks and create two groups.
 */
export async function lockEmployer(tx: Tx, s: { companyDomain: string | null; family: string; tenant: string }) {
  await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${lockKey(s)}))`);
}

/** More open postings than this under one requisition id means the id is a placeholder. */
export const REQUISITION_FANOUT = 12;

/** `id in (...)` for raw SQL. A JS array interpolated directly becomes a tuple, not a Postgres array. */
const idList = (ids: string[]) => sql.join(ids.map((id) => sql`${id}::uuid`), sql`, `);

interface Candidate {
  jobId: string;
  otherId: string;
  reason: "url" | "requisition" | "similar";
  score?: number;
}

export type LocJob = { id: string; workplace: string; locations: JobLocation[] };

/**
 * Links every changed job that matches an existing one. Returns how many
 * links were made. Must run inside the source transaction after lockEmployer.
 */
export async function linkChanged(tx: Tx, changedIds: string[]): Promise<number> {
  if (!changedIds.length) return 0;

  const already = new Set(
    (await tx.select({ jobId: jobGroupLinks.jobId }).from(jobGroupLinks).where(inArray(jobGroupLinks.jobId, changedIds))).map(
      (r) => r.jobId,
    ),
  );
  const open = changedIds.filter((id) => !already.has(id));
  if (!open.length) return 0;

  const chosen = new Map<string, Candidate>();
  const take = (c: Candidate) => {
    if (!chosen.has(c.jobId)) chosen.set(c.jobId, c);
  };

  // 2. Same normalised apply URL anywhere.
  const byUrl = await tx.execute<{ job_id: string; other_id: string }>(sql`
    select distinct on (c.id) c.id as job_id, o.id as other_id
    from jobs c join jobs o on o.apply_url_norm = c.apply_url_norm and o.id <> c.id
    where c.id in (${idList(open)})
    order by c.id, o.first_seen_at asc
  `);
  for (const r of byUrl.rows) take({ jobId: r.job_id, otherId: r.other_id, reason: "url" });

  // 3. Same company and requisition id, where the family exposes one.
  //    Greenhouse's requisition_id is free text and boards fill it with
  //    placeholders: Stripe writes "See Opening ID" on every posting, Airbnb
  //    "ONE" and "MULTI". Two guards: the value must carry a digit, and a
  //    value shared by more than REQUISITION_FANOUT open postings of one
  //    company is a placeholder, not a requisition posted in many cities.
  const byReq = await tx.execute<{ job_id: string; other_id: string }>(sql`
    select distinct on (c.id) c.id as job_id, o.id as other_id
    from jobs c join jobs o
      on o.company_domain = c.company_domain and o.requisition_id = c.requisition_id and o.id <> c.id
    where c.id in (${idList(open)})
      and c.company_domain is not null and c.requisition_id is not null
      and c.requisition_id ~ '[0-9]'
      and length(c.requisition_id) <= 40
      and (select count(*) from jobs x
           where x.company_domain = c.company_domain and x.requisition_id = c.requisition_id and x.closed_at is null)
          <= ${REQUISITION_FANOUT}
    order by c.id, o.first_seen_at asc
  `);
  for (const r of byReq.rows) take({ jobId: r.job_id, otherId: r.other_id, reason: "requisition" });

  // 4. Same company, same normalised title, a shared location or both remote,
  //    and a similar core description. Every near match is logged.
  const remaining = open.filter((id) => !chosen.has(id));
  if (remaining.length) {
    const threshold = env().SIMILARITY_THRESHOLD;
    const near = await tx.execute<{
      job_id: string;
      other_id: string;
      score: number;
      c_workplace: string;
      c_locations: JobLocation[];
      c_family: string;
      c_req: string | null;
      o_workplace: string;
      o_locations: JobLocation[];
      o_family: string;
      o_req: string | null;
    }>(sql`
      select c.id as job_id, o.id as other_id,
             similarity(o.description_core, c.description_core) as score,
             c.workplace as c_workplace, c.locations as c_locations,
             c.family as c_family, c.requisition_id as c_req,
             o.workplace as o_workplace, o.locations as o_locations,
             o.family as o_family, o.requisition_id as o_req
      from jobs c join jobs o
        on o.company_domain = c.company_domain and o.title_norm = c.title_norm and o.id <> c.id and o.closed_at is null
      where c.id in (${idList(remaining)})
        and c.company_domain is not null
        and length(c.description_core) >= 200
        and similarity(o.description_core, c.description_core) >= 0.6
      order by c.id, score desc
    `);
    const logRows: (typeof similarityLog.$inferInsert)[] = [];
    let conflicts = 0;
    for (const r of near.rows) {
      const share = locationsOverlap(
        { id: r.job_id, workplace: r.c_workplace, locations: r.c_locations },
        { id: r.other_id, workplace: r.o_workplace, locations: r.o_locations },
      );
      const conflict = requisitionConflict(r.c_family, r.c_req, r.o_family, r.o_req);
      if (conflict) conflicts += 1;
      const merged = share && !conflict && Number(r.score) >= threshold && !chosen.has(r.job_id);
      logRows.push({ jobA: r.job_id, jobB: r.other_id, score: Number(r.score), merged });
      if (merged) take({ jobId: r.job_id, otherId: r.other_id, reason: "similar", score: Number(r.score) });
    }
    if (conflicts) console.log(`  ${conflicts} similarity candidates refused: the two postings carry different requisition ids`);
    for (let i = 0; i < logRows.length; i += 500) await tx.insert(similarityLog).values(logRows.slice(i, i + 500));
  }

  let linked = 0;
  for (const c of chosen.values()) {
    await attach(tx, c);
    linked += 1;
  }
  return linked;
}

/**
 * The country as a comparable token: the ISO code when the feed gave one,
 * otherwise the board's own country name. The prefix keeps the two apart, and
 * `sameCountry` never compares across the two kinds, because a name the code
 * table did not resolve is an unknown country, not a different one, and an
 * unknown never fails a rule.
 */
function countryKey(l: JobLocation): string | undefined {
  if (l.country) return l.country.toUpperCase();
  if (l.countryName) return `name:${l.countryName.trim().toLowerCase()}`;
  return undefined;
}

/** null when the two cannot be compared: no token on one side, or a code against an unresolved name. */
function sameCountry(a: string | undefined, b: string | undefined): boolean | null {
  if (!a || !b) return null;
  if (a.startsWith("name:") !== b.startsWith("name:")) return null;
  return a === b;
}

function countriesOf(j: LocJob): Set<string> {
  const out = new Set<string>();
  for (const l of j.locations) {
    const k = countryKey(l);
    if (k) out.add(k);
  }
  return out;
}

const norm = (s: string | undefined) => s?.trim().toLowerCase() || undefined;

/**
 * One location against one location. The country is a gate, not a rung: two
 * places in different countries are never the same place, whatever else
 * matches. "Cambridge, GB" and "Cambridge, US" used to overlap on the city
 * alone. Below the gate the finest shared level decides, and when neither
 * side names anything finer than the country, the country itself is enough,
 * so "Austin, TX, US" and a company wide "United States" posting of the same
 * title now meet.
 */
function samePlace(la: JobLocation, lb: JobLocation): boolean {
  const country = sameCountry(countryKey(la), countryKey(lb));
  if (country === false) return false;
  const cityA = norm(la.city);
  const cityB = norm(lb.city);
  if (cityA && cityB) return cityA === cityB;
  const regionA = norm(la.region);
  const regionB = norm(lb.region);
  if (regionA && regionB) return regionA === regionB;
  if (country === true) return true;
  return norm(la.raw) === norm(lb.raw);
}

/**
 * Whether two postings can be in the same place. Remote is treated as
 * possibly country restricted: two remote roles that each name a country and
 * share none of them are two different opportunities, not one, because
 * "Remote, United States" and "Remote, Germany" are what a company posts when
 * it wants a person in each. A remote role that names no country at all is
 * unrestricted as far as the feed says, so it still overlaps anything remote.
 */
export function locationsOverlap(a: LocJob, b: LocJob): boolean {
  const aRemote = a.workplace === "remote" || a.locations.some((l) => l.remote);
  const bRemote = b.workplace === "remote" || b.locations.some((l) => l.remote);
  if (aRemote && bRemote) {
    const ac = countriesOf(a);
    const bc = countriesOf(b);
    if (!ac.size || !bc.size) return true;
    for (const x of ac) for (const y of bc) if (sameCountry(x, y) !== false) return true;
    return false;
  }
  return a.locations.some((la) => b.locations.some((lb) => samePlace(la, lb)));
}

/** A requisition id that identifies one requisition rather than a placeholder: it carries a digit and is short. */
const realRequisition = (id: string | null): id is string => !!id && /[0-9]/.test(id) && id.length <= 40;

/**
 * Whether two requisition ids say, on their own, that these are two different
 * openings. Only within one family: a board numbers its own requisitions, so
 * two different ids from one board are the employer saying two openings. Two
 * ids from different boards are two unrelated schemes, and reading a
 * difference into them would refuse exactly the syndication merge the
 * similarity rule exists to make. Placeholders such as Airbnb's "ONE" and
 * "MULTI" carry no digit and are ignored on both sides.
 *
 * Measured before it shipped: over the 48 similarity merges that existed on
 * 17 Sep 2026 this refuses 18, all Greenhouse against Greenhouse, all
 * distinct real ids, mostly one Datadog sales role posted per US territory.
 */
export function requisitionConflict(familyA: string, reqA: string | null, familyB: string, reqB: string | null): boolean {
  if (familyA !== familyB) return false;
  if (!realRequisition(reqA) || !realRequisition(reqB)) return false;
  return reqA !== reqB;
}

/**
 * Membership is read for both sides at attach time, not when the candidates
 * were computed. Within one batch a job can already have been placed as the
 * native anchor of another job's group before its own candidate is reached;
 * creating a second group for it then leaves the other job alone in that
 * group, because the job's own link insert hits the unique constraint. So:
 * join whichever group exists, and only create one when neither side has one.
 * Two jobs that already sit in different groups are left as they are; groups
 * are not merged here.
 */
async function attach(tx: Tx, c: Candidate): Promise<void> {
  const mine = await groupOf(tx, c.jobId);
  const theirs = await groupOf(tx, c.otherId);
  if (mine && theirs) return;
  let groupId: string;
  if (theirs) {
    groupId = theirs;
    await insertLink(tx, groupId, c.jobId, c.reason, c.score);
  } else if (mine) {
    groupId = mine;
    await insertLink(tx, groupId, c.otherId, c.reason, c.score);
  } else {
    const pair = await tx
      .select({ id: jobs.id, firstSeenAt: jobs.firstSeenAt })
      .from(jobs)
      .where(inArray(jobs.id, [c.jobId, c.otherId]));
    const canonical = pair.sort((x, y) => x.firstSeenAt.getTime() - y.firstSeenAt.getTime())[0];
    const [g] = await tx.insert(jobGroups).values({ canonicalJobId: canonical.id }).returning({ id: jobGroups.id });
    groupId = g.id;
    await insertLink(tx, groupId, c.otherId, "native", undefined);
    await insertLink(tx, groupId, c.jobId, c.reason, c.score);
  }
  await recomputeCanonical(tx, groupId);
}

async function groupOf(tx: Tx, jobId: string): Promise<string | null> {
  const rows = await tx.select({ groupId: jobGroupLinks.groupId }).from(jobGroupLinks).where(eq(jobGroupLinks.jobId, jobId));
  return rows[0]?.groupId ?? null;
}

/**
 * The unique constraint on job_group_links(job_id) is the backstop against a
 * concurrent link. If it fires, the job already has a group; nothing to do.
 */
async function insertLink(
  tx: Tx,
  groupId: string,
  jobId: string,
  reason: "native" | "url" | "requisition" | "similar",
  score: number | undefined,
) {
  await tx.insert(jobGroupLinks).values({ groupId, jobId, reason, score }).onConflictDoNothing({ target: jobGroupLinks.jobId });
}

/** Canonical is the earliest open member. With no open member the pointer stays put and the feed drops the group. */
export async function recomputeCanonical(tx: Tx, groupId: string): Promise<void> {
  await tx.execute(sql`
    update job_groups g
    set canonical_job_id = coalesce(
      (select j.id from job_group_links l join jobs j on j.id = l.job_id
        where l.group_id = g.id and j.closed_at is null
        order by j.first_seen_at asc limit 1),
      g.canonical_job_id),
      updated_at = now()
    where g.id = ${groupId}
  `);
}

/** Recomputes every group that has a member among the given jobs. */
export async function recomputeCanonicalFor(tx: Tx, jobIds: string[]): Promise<void> {
  if (!jobIds.length) return;
  const groups = await tx
    .selectDistinct({ groupId: jobGroupLinks.groupId })
    .from(jobGroupLinks)
    .where(and(inArray(jobGroupLinks.jobId, jobIds)));
  for (const g of groups) await recomputeCanonical(tx, g.groupId);
}

export type { Job };
