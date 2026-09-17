import { and, eq, inArray, isNull, notInArray, sql } from "drizzle-orm";
import { dbPool, type DbPool, type Tx } from "@/db/client";
import { costEvents, jobs, sources, type NewJob, type Source } from "@/db/schema";
import { env } from "@/lib/env";
import { linkChanged, lockEmployer, normaliseApplyUrl, recomputeCanonicalFor } from "@/server/jobs/identity";
import { contentHash, descriptionCore, detectRepeated, normalise } from "@/server/jobs/normalize";
import { ADAPTERS } from "./registry";
import { FetchError, type RawPosting } from "./types";

/*
 * Ingest. Plain functions with no Vercel imports so the cron route today and
 * an always on worker later are both just entry points.
 *
 * Everything per source is set based: one read of what is known, chunked
 * upserts, one closing statement, and linking as joins over the ids that
 * changed. A board with five thousand postings costs a few dozen queries,
 * not thirty thousand.
 */

export interface SourceRun {
  sourceId: string;
  family: string;
  tenant: string;
  status: "ok" | "not_modified" | "failed" | "paused";
  inserted: number;
  updated: number;
  closed: number;
  linked: number;
  detailPending: number;
  ms: number;
  error?: string;
}

const MAX_FAILURES = 3;
const CHUNK = 150;

/*
 * last_polled_at has exactly one writer: the claim. It is also the ORDER BY
 * key with NULLS FIRST, so a source that is polled without being claimed
 * would sit at the front of the queue on every run and, once the registry
 * outgrows one batch, starve the long tail. The post-poll updates name their
 * columns and never touch it, and every entry point that polls a source goes
 * through claimBatch or claimTenant.
 */

/**
 * Claims up to `batch` active sources with the oldest last_polled_at in one
 * statement, so an overlapping run cannot pick the same ones.
 */
export async function claimBatch(db: DbPool, batch: number): Promise<Source[]> {
  const claimed = await db.execute<Record<string, unknown>>(sql`
    update sources set last_polled_at = now()
    where id in (
      select id from sources where active
      order by last_polled_at nulls first
      limit ${batch} for update skip locked
    )
    returning *
  `);
  return claimed.rows.map(rowToSource);
}

/** Claims one tenant by name, active or not, for a manual poll. */
export async function claimTenant(db: DbPool, tenant: string): Promise<Source[]> {
  const claimed = await db.execute<Record<string, unknown>>(sql`
    update sources set last_polled_at = now() where tenant = ${tenant} returning *
  `);
  return claimed.rows.map(rowToSource);
}

/** Claims a batch, polls it in sequence, returns one line per source. */
export async function ingestBatch(batch = env().INGEST_BATCH): Promise<SourceRun[]> {
  const db = dbPool();
  const rows = await claimBatch(db, batch);
  const runs: SourceRun[] = [];
  for (const s of rows) runs.push(await ingestSource(db, s));
  return runs;
}

/** Polls one source. Never throws; the outcome is on the returned run and the source row. */
export async function ingestSource(db: DbPool, source: Source): Promise<SourceRun> {
  const started = Date.now();
  const run: SourceRun = {
    sourceId: source.id,
    family: source.family,
    tenant: source.tenant,
    status: "ok",
    inserted: 0,
    updated: 0,
    closed: 0,
    linked: 0,
    detailPending: 0,
    ms: 0,
  };
  const adapter = ADAPTERS[source.family];
  try {
    const known = await knownJobs(db, source.id);
    const result = await adapter.fetch(source, {
      detailBudget: env().DETAIL_FETCH_BATCH,
      known: new Map([...known].map(([k, v]) => [k, { listHash: v.listHash, detailPending: v.detailPending }])),
    });

    if (result.notModified) {
      run.status = "not_modified";
      await db
        .update(sources)
        .set({ lastStatus: "not_modified", lastError: null, consecutiveFailures: 0 })
        .where(eq(sources.id, source.id));
    } else {
      await db.transaction(async (tx) => {
        await lockEmployer(tx, source);
        const outcome = await applyPostings(tx, source, result.postings, known);
        Object.assign(run, outcome);
        await tx
          .update(sources)
          .set({
            etag: result.etag ?? source.etag,
            lastStatus: "ok",
            lastError: null,
            consecutiveFailures: 0,
            jobCount: sql`(select count(*) from jobs where source_id = ${source.id} and closed_at is null)`,
          })
          .where(eq(sources.id, source.id));
      });
    }
  } catch (err) {
    const message = errorMessage(err);
    const failures = source.consecutiveFailures + 1;
    const paused = failures >= MAX_FAILURES;
    run.status = paused ? "paused" : "failed";
    run.error = message;
    await db
      .update(sources)
      .set({
        lastStatus: paused ? "paused" : "failed",
        lastError: message.slice(0, 500),
        consecutiveFailures: failures,
        active: !paused,
      })
      .where(eq(sources.id, source.id));
  }
  run.ms = Date.now() - started;
  await db.insert(costEvents).values({ kind: "ingest", refId: source.id, ms: run.ms });
  return run;
}

export interface Known {
  id: string;
  contentHash: string;
  listHash: string | null;
  detailPending: boolean;
  boilerplateVersion: number;
}

export async function knownJobs(db: DbPool | Tx, sourceId: string): Promise<Map<string, Known>> {
  const rows = await db
    .select({
      id: jobs.id,
      nativeId: jobs.nativeId,
      contentHash: jobs.contentHash,
      listHash: jobs.listHash,
      detailPending: jobs.detailPending,
      boilerplateVersion: jobs.boilerplateVersion,
    })
    .from(jobs)
    .where(eq(jobs.sourceId, sourceId));
  return new Map(rows.map((r) => [r.nativeId, r]));
}

interface ApplyOutcome {
  inserted: number;
  updated: number;
  closed: number;
  linked: number;
  detailPending: number;
}

/**
 * Upserts every posting in chunks, links what is new or changed, then closes
 * what the feed no longer lists. Boilerplate detection runs first so every
 * job in this poll is hashed under the same version.
 */
export async function applyPostings(tx: Tx, source: Source, postings: RawPosting[], known: Map<string, Known>): Promise<ApplyOutcome> {
  const out: ApplyOutcome = { inserted: 0, updated: 0, closed: 0, linked: 0, detailPending: 0 };
  const now = new Date();

  const bp = await refreshBoilerplate(tx, source, postings, known);

  const full: NewJob[] = [];
  /*
   * Rows whose body this run did not fetch. "stored" is an unchanged listing
   * with its body already in the row; "pending" is a changed listing whose
   * refetch did not happen yet. Both keep the stored body and every signal
   * read from it; pending also marks the row so the next poll drains it
   * (the adapter skips the conditional request while any row is pending),
   * which is what stops a changed posting from being stranded behind a 304.
   */
  const touchOnly: { id: string; listHash: string | null; pending: boolean }[] = [];
  const seen: string[] = [];
  for (const p of mergeDuplicates(postings)) {
    seen.push(p.nativeId);
    const prior = known.get(p.nativeId);
    if (prior && (p.detail === "stored" || p.detail === "pending")) {
      touchOnly.push({ id: prior.id, listHash: p.listHash ?? null, pending: p.detail === "pending" });
      continue;
    }
    const n = normalise(p, bp.paragraphs);
    full.push({
      sourceId: source.id,
      family: source.family,
      nativeId: p.nativeId,
      requisitionId: p.requisitionId ?? null,
      title: n.title,
      titleNorm: n.titleNorm,
      companyName: source.companyName,
      companyDomain: source.companyDomain,
      locations: n.locations,
      workplace: n.workplace,
      employmentType: n.employmentType ?? null,
      compMin: n.comp?.min != null ? Math.round(n.comp.min) : null,
      compMax: n.comp?.max != null ? Math.round(n.comp.max) : null,
      compCurrency: n.comp?.currency ?? null,
      compPeriod: n.comp?.period ?? "unknown",
      seniority: n.seniority ?? null,
      sponsorship: n.sponsorship,
      sponsorshipEvidence: n.sponsorshipEvidence ?? null,
      eligibility: n.eligibility ?? null,
      eligibilityCountry: n.eligibilityCountry ?? null,
      eligibilityEvidence: n.eligibilityEvidence ?? null,
      descriptionText: n.descriptionText,
      descriptionHtml: n.descriptionHtml,
      descriptionCore: n.descriptionCore,
      contentHash: n.contentHash,
      boilerplateVersion: bp.version,
      applyUrl: p.applyUrl,
      applyUrlNorm: normaliseApplyUrl(p.applyUrl, source.family),
      postedAt: p.postedAt ?? null,
      lastCheckedAt: now,
      missedPolls: 0,
      closedAt: null,
      detailPending: p.detail === "pending",
      listHash: p.listHash ?? null,
    });
  }

  const changed: string[] = [];
  for (let i = 0; i < full.length; i += CHUNK) {
    const chunk = full.slice(i, i + CHUNK);
    const rows = await tx
      .insert(jobs)
      .values(chunk)
      .onConflictDoUpdate({
        target: [jobs.family, jobs.sourceId, jobs.nativeId],
        set: {
          requisitionId: sql`excluded.requisition_id`,
          title: sql`excluded.title`,
          titleNorm: sql`excluded.title_norm`,
          locations: sql`excluded.locations`,
          workplace: sql`excluded.workplace`,
          employmentType: sql`excluded.employment_type`,
          compMin: sql`excluded.comp_min`,
          compMax: sql`excluded.comp_max`,
          compCurrency: sql`excluded.comp_currency`,
          compPeriod: sql`excluded.comp_period`,
          seniority: sql`excluded.seniority`,
          sponsorship: sql`excluded.sponsorship`,
          sponsorshipEvidence: sql`excluded.sponsorship_evidence`,
          eligibility: sql`excluded.eligibility`,
          eligibilityCountry: sql`excluded.eligibility_country`,
          eligibilityEvidence: sql`excluded.eligibility_evidence`,
          descriptionText: sql`excluded.description_text`,
          descriptionHtml: sql`excluded.description_html`,
          descriptionCore: sql`excluded.description_core`,
          contentHash: sql`excluded.content_hash`,
          boilerplateVersion: sql`excluded.boilerplate_version`,
          applyUrl: sql`excluded.apply_url`,
          applyUrlNorm: sql`excluded.apply_url_norm`,
          postedAt: sql`excluded.posted_at`,
          lastCheckedAt: sql`excluded.last_checked_at`,
          missedPolls: 0,
          closedAt: null,
          detailPending: sql`excluded.detail_pending`,
          listHash: sql`excluded.list_hash`,
        },
      })
      .returning({ id: jobs.id, nativeId: jobs.nativeId, contentHash: jobs.contentHash, detailPending: jobs.detailPending });
    for (const r of rows) {
      const prior = known.get(r.nativeId);
      if (r.detailPending) out.detailPending += 1;
      if (!prior) {
        out.inserted += 1;
        if (!r.detailPending) changed.push(r.id);
      } else if (prior.contentHash !== r.contentHash) {
        out.updated += 1;
        if (!r.detailPending) changed.push(r.id);
      }
    }
  }

  for (const pending of [false, true]) {
    const rows = touchOnly.filter((c) => c.pending === pending);
    for (let i = 0; i < rows.length; i += CHUNK) {
      const chunk = rows.slice(i, i + CHUNK);
      await tx
        .update(jobs)
        .set(pending ? { lastCheckedAt: now, missedPolls: 0, closedAt: null, detailPending: true } : { lastCheckedAt: now, missedPolls: 0, closedAt: null })
        .where(inArray(jobs.id, chunk.map((c) => c.id)));
      if (pending) out.detailPending += chunk.length;
    }
  }

  out.linked = await linkChanged(tx, changed);

  // Closing: present resets the counter, absent advances it, two misses close.
  if (seen.length) {
    const absent = await tx
      .update(jobs)
      .set({ missedPolls: sql`${jobs.missedPolls} + 1` })
      .where(and(eq(jobs.sourceId, source.id), isNull(jobs.closedAt), notInArray(jobs.nativeId, seen)))
      .returning({ id: jobs.id, missedPolls: jobs.missedPolls });
    const toClose = absent.filter((j) => j.missedPolls >= 2).map((j) => j.id);
    if (toClose.length) {
      await tx.update(jobs).set({ closedAt: now }).where(inArray(jobs.id, toClose));
      out.closed = toClose.length;
      await recomputeCanonicalFor(tx, toClose);
    }
  }
  return out;
}

/**
 * Some boards list one entry per location under the same native id, Workable
 * among them. Postgres refuses an upsert that touches one key twice, and the
 * job is one job, so the entries collapse into one with every location kept.
 */
function mergeDuplicates(postings: RawPosting[]): RawPosting[] {
  const byId = new Map<string, RawPosting>();
  for (const p of postings) {
    const prior = byId.get(p.nativeId);
    if (!prior) {
      byId.set(p.nativeId, { ...p, locations: [...p.locations] });
      continue;
    }
    for (const l of p.locations) if (!prior.locations.some((x) => x.raw === l.raw)) prior.locations.push(l);
    if (!prior.descriptionHtml && p.descriptionHtml) prior.descriptionHtml = p.descriptionHtml;
    if (prior.remote !== true && p.remote === true) prior.remote = true;
    if (prior.detail !== "fetched" && p.detail === "fetched") prior.detail = "fetched";
  }
  return [...byId.values()];
}

/**
 * Recomputes the source's boilerplate set from this feed. When it changes,
 * the version increments and every existing job of the source that was
 * hashed under the old version is rehashed in the same transaction. Matches,
 * when they exist, copy the new hash so a recompute never triggers a paid
 * rescore; that copy lands with the profile pull request.
 */
async function refreshBoilerplate(
  tx: Tx,
  source: Source,
  postings: RawPosting[],
  known: Map<string, Known>,
): Promise<{ version: number; paragraphs: string[] }> {
  const texts = postings.filter((p) => p.descriptionHtml).map((p) => normalise(p, []).descriptionText);
  const detected = detectRepeated(texts).sort();
  const same = detected.length === source.boilerplate.length && detected.every((p, i) => p === source.boilerplate[i]);
  if (same) return { version: source.boilerplateVersion, paragraphs: source.boilerplate };

  const version = source.boilerplateVersion + 1;
  await tx.update(sources).set({ boilerplate: detected, boilerplateVersion: version }).where(eq(sources.id, source.id));

  // Only rows that will not be rewritten by this poll's upsert need a rehash:
  // jobs the feed no longer lists but that are still open.
  const listed = new Set(postings.map((p) => p.nativeId));
  const stale = [...known.entries()].filter(([nativeId, k]) => !listed.has(nativeId) && k.boilerplateVersion !== version).map(([, k]) => k.id);
  for (let i = 0; i < stale.length; i += CHUNK) {
    const rows = await tx
      .select({ id: jobs.id, title: jobs.title, locations: jobs.locations, descriptionText: jobs.descriptionText })
      .from(jobs)
      .where(inArray(jobs.id, stale.slice(i, i + CHUNK)));
    for (const r of rows) {
      const core = descriptionCore(r.descriptionText, detected);
      await tx
        .update(jobs)
        .set({ descriptionCore: core, contentHash: contentHash(r.title, r.locations, core), boilerplateVersion: version })
        .where(eq(jobs.id, r.id));
    }
  }
  return { version, paragraphs: detected };
}

/**
 * Drizzle wraps a failed statement in "Failed query: <sql> params: <values>",
 * which buries the Postgres message under kilobytes of parameters. The cause
 * carries the real error, so that is what the source row records.
 */
function errorMessage(err: unknown): string {
  if (err instanceof FetchError) return `HTTP ${err.status}`;
  if (err instanceof Error) {
    const cause = (err as Error & { cause?: unknown }).cause;
    if (cause instanceof Error && cause.message) return cause.message;
    return err.message.split("\n")[0].slice(0, 300);
  }
  return String(err);
}

function rowToSource(r: Record<string, unknown>): Source {
  return {
    id: r.id as string,
    family: r.family as Source["family"],
    tenant: r.tenant as string,
    companyName: r.company_name as string,
    companyDomain: (r.company_domain as string | null) ?? null,
    active: r.active as boolean,
    etag: (r.etag as string | null) ?? null,
    lastPolledAt: r.last_polled_at ? new Date(r.last_polled_at as string) : null,
    lastStatus: (r.last_status as string | null) ?? null,
    lastError: (r.last_error as string | null) ?? null,
    consecutiveFailures: Number(r.consecutive_failures ?? 0),
    jobCount: Number(r.job_count ?? 0),
    boilerplateVersion: Number(r.boilerplate_version ?? 0),
    boilerplate: (r.boilerplate as string[]) ?? [],
    createdAt: new Date(r.created_at as string),
  };
}
