import { eq, inArray, sql } from "drizzle-orm";
import { dbPool, type DbPool, type Tx } from "@/db/client";
import { costEvents, jobs, matches, profileFacts } from "@/db/schema";
import { env } from "@/lib/env";
import { claimMatches, type ClaimedRow } from "./claim";
import { scoringProfile, type ScoringProfile } from "./profile";
import { ScoreError, scoreJob, type PromptOrder, type ScoringJob } from "./score";
import { filterFacts } from "@/server/profile/viewer";

/*
 * The scoring run: claim, score with bounded concurrency, write the row and
 * its cost event. The cron calls `scoreBatch`; the sample script calls
 * `scoreClaimed` with rows it inserted itself and a run tag, so its cost
 * rows stay apart from the cron's (D-003). Nothing else scores (D-004).
 */

export interface RunOptions {
  model?: string;
  concurrency?: number;
  /** Tag written to cost_events.run. Null, the default, means the cron. */
  run?: string | null;
  order?: PromptOrder;
  batch?: number;
}

export interface ScoredLine {
  matchId: string;
  jobId: string;
  ok: boolean;
  score?: number;
  error?: string;
  tokensIn: number;
  tokensCached: number;
  tokensOut: number;
  usd: number;
  ms: number;
}

export interface UserRun {
  userId: string;
  claimed: number;
  fresh: number;
  rework: number;
  scored: number;
  failed: number;
  usd: number;
  lines: ScoredLine[];
}

export async function loadScoringJobs(db: DbPool | Tx, ids: string[]): Promise<Map<string, ScoringJob>> {
  if (!ids.length) return new Map();
  const rows = await db
    .select({
      id: jobs.id,
      title: jobs.title,
      companyName: jobs.companyName,
      locations: jobs.locations,
      workplace: jobs.workplace,
      employmentType: jobs.employmentType,
      seniority: jobs.seniority,
      compRaw: jobs.compRaw,
      compMin: jobs.compMin,
      compMax: jobs.compMax,
      compCurrency: jobs.compCurrency,
      compPeriod: jobs.compPeriod,
      descriptionCore: jobs.descriptionCore,
      contentHash: jobs.contentHash,
    })
    .from(jobs)
    .where(inArray(jobs.id, ids));
  return new Map(rows.map((r) => [r.id, r]));
}

/** Runs `fn` over `items` with at most `n` in flight. Order of results follows the input. */
async function pool<T, R>(items: T[], n: number, fn: (t: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  const worker = async () => {
    for (;;) {
      const i = next++;
      if (i >= items.length) return;
      out[i] = await fn(items[i]);
    }
  };
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, worker));
  return out;
}

/** Scores rows already claimed. Writes each match row and its cost event; never throws for one row. */
export async function scoreClaimed(db: DbPool | Tx, profile: ScoringProfile, claimed: ClaimedRow[], opts: RunOptions = {}): Promise<ScoredLine[]> {
  const model = opts.model ?? env().MODEL_SCORE ?? "gpt-5.6-luna";
  const jobsById = await loadScoringJobs(db, claimed.map((c) => c.jobId));
  return pool(claimed, opts.concurrency ?? env().SCORE_CONCURRENCY, async (c): Promise<ScoredLine> => {
    const job = jobsById.get(c.jobId);
    if (!job) {
      await db.update(matches).set({ status: "failed", error: "job row missing", updatedAt: new Date() }).where(eq(matches.id, c.id));
      return { matchId: c.id, jobId: c.jobId, ok: false, error: "job row missing", tokensIn: 0, tokensCached: 0, tokensOut: 0, usd: 0, ms: 0 };
    }
    try {
      const r = await scoreJob(profile.block, job, { model, order: opts.order });
      await db
        .update(matches)
        .set({
          status: "scored",
          score: r.score,
          band: r.band,
          reasons: r.reasons,
          unknowns: r.unknowns,
          scoredAt: new Date(),
          model,
          tokensIn: r.usage.inputTokens,
          tokensOut: r.usage.outputTokens,
          usd: r.usd,
          error: null,
          updatedAt: new Date(),
        })
        .where(eq(matches.id, c.id));
      await db.insert(costEvents).values({
        kind: "score",
        model,
        userId: profile.userId,
        refId: c.id,
        tokensIn: r.usage.inputTokens,
        tokensCached: r.usage.cachedInputTokens,
        tokensOut: r.usage.outputTokens,
        usd: r.usd,
        ms: r.ms,
        run: opts.run ?? null,
      });
      return {
        matchId: c.id,
        jobId: c.jobId,
        ok: true,
        score: r.score,
        tokensIn: r.usage.inputTokens,
        tokensCached: r.usage.cachedInputTokens,
        tokensOut: r.usage.outputTokens,
        usd: r.usd,
        ms: r.ms,
      };
    } catch (e) {
      const err = e instanceof ScoreError ? e : new ScoreError(e instanceof Error ? e.message : String(e), model, null, 0, 0);
      await db.update(matches).set({ status: "failed", error: err.message.slice(0, 500), model, updatedAt: new Date() }).where(eq(matches.id, c.id));
      // A call that was made and failed still cost money; the worksheet records it.
      if (err.usage) {
        await db.insert(costEvents).values({
          kind: "score",
          model,
          userId: profile.userId,
          refId: c.id,
          tokensIn: err.usage.inputTokens,
          tokensCached: err.usage.cachedInputTokens,
          tokensOut: err.usage.outputTokens,
          usd: err.usd,
          ms: err.ms,
          run: opts.run ?? null,
        });
      }
      return {
        matchId: c.id,
        jobId: c.jobId,
        ok: false,
        error: err.message,
        tokensIn: err.usage?.inputTokens ?? 0,
        tokensCached: err.usage?.cachedInputTokens ?? 0,
        tokensOut: err.usage?.outputTokens ?? 0,
        usd: err.usd,
        ms: err.ms,
      };
    }
  });
}

/** Claims one batch for one user and scores it. Returns null when the user has no confirmed profile to score against. */
export async function scoreForUser(db: DbPool | Tx, userId: string, opts: RunOptions = {}): Promise<UserRun | null> {
  const [profile, facts] = await Promise.all([scoringProfile(db, userId), filterFacts(userId, db)]);
  if (!profile || !facts) return null;
  const claimed = await claimMatches(db, { userId, facts, prefsHash: profile.prefsHash, factsHash: profile.factsHash }, opts.batch ?? env().SCORE_BATCH);
  const lines = await scoreClaimed(db, profile, claimed, opts);
  return {
    userId,
    claimed: claimed.length,
    fresh: claimed.filter((c) => c.via === "new").length,
    rework: claimed.filter((c) => c.via === "rework").length,
    scored: lines.filter((l) => l.ok).length,
    failed: lines.filter((l) => !l.ok).length,
    usd: Number(lines.reduce((a, l) => a + l.usd, 0).toFixed(6)),
    lines,
  };
}

/** The cron entry: every user with a confirmed preference fact, one batch each. */
export async function scoreBatch(opts: RunOptions = {}): Promise<UserRun[]> {
  const db = dbPool();
  const users = await db
    .selectDistinct({ userId: profileFacts.userId })
    .from(profileFacts)
    .where(sql`${profileFacts.kind} = 'preference' and ${profileFacts.status} = 'confirmed'`);
  const runs: UserRun[] = [];
  for (const u of users) {
    const r = await scoreForUser(db, u.userId, opts);
    if (r) runs.push(r);
  }
  return runs;
}
