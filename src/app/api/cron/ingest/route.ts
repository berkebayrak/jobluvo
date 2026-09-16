import { cronAuthorised, unauthorised } from "@/server/cron";
import { ingestBatch } from "@/server/sources/ingest";

/**
 * Polls the INGEST_BATCH sources with the oldest last_polled_at and returns.
 *
 * vercel.json schedules this once a day, because the account is on Vercel
 * Hobby, where cron runs daily and a function gets 60 seconds. JSON has no
 * comments, so the reason lives here: a 15 minute cadence needs Pro or the
 * always on worker the plan names as the real home for polling. In Phase 0
 * freshness comes from calling this route by hand with the secret, or from
 * `npm run ingest` locally.
 */
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(req: Request) {
  if (!cronAuthorised(req)) return unauthorised();
  const started = Date.now();
  const runs = await ingestBatch();
  return Response.json({ ms: Date.now() - started, sources: runs.length, runs });
}
