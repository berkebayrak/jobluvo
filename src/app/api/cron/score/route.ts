import { cronAuthorised, unauthorised } from "@/server/cron";
import { scoreBatch } from "@/server/match/run";

/**
 * Scores one batch per user: jobs first seen in the last 24 hours that pass
 * the user's hard filter, plus rework rows. The only place a match score is
 * computed (D-004). vercel.json runs it once a day after the ingest; on
 * Hobby that is the cadence, and SCORE_BATCH is sized to finish inside the
 * 60 second ceiling. The response is the run summary without the per row
 * lines, which are in matches and cost_events.
 */
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(req: Request) {
  if (!cronAuthorised(req)) return unauthorised();
  const started = Date.now();
  const runs = await scoreBatch();
  return Response.json({
    ms: Date.now() - started,
    users: runs.map(({ lines, ...rest }) => ({ ...rest, errors: lines.filter((l) => !l.ok).map((l) => l.error) })),
  });
}
