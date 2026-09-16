import { z } from "zod";

/**
 * Server environment, parsed once. Import this instead of reading
 * process.env so a missing value fails at startup with its name, not later
 * with an undefined somewhere in a query.
 *
 * DATABASE_URL is the pooled Neon host and serves the app. DATABASE_URL_UNPOOLED
 * is the direct host and is only read by drizzle-kit for migrations.
 */
const schema = z.object({
  DATABASE_URL: z.string().url(),
  DATABASE_URL_UNPOOLED: z.string().url().optional(),
  OPENAI_API_KEY: z.string().optional(),
  MODEL_EXTRACT: z.string().optional(),
  MODEL_SCORE: z.string().optional(),
  MODEL_TAILOR: z.string().optional(),
  CRON_SECRET: z.string().min(8),
  /*
   * Batch sizes are sized against Vercel Hobby: a 60 second function ceiling
   * and a cron that fires once a day. Five boards and twenty scoring calls
   * fit inside 60 seconds from iad1. A 15 minute cadence needs Pro or the
   * always on worker; do not size these as if it existed.
   */
  INGEST_BATCH: z.coerce.number().int().positive().default(5),
  DETAIL_FETCH_BATCH: z.coerce.number().int().positive().default(40),
  SCORE_BATCH: z.coerce.number().int().positive().default(20),
  SCORE_CONCURRENCY: z.coerce.number().int().positive().default(5),
  SIMILARITY_THRESHOLD: z.coerce.number().min(0).max(1).default(0.85),
});

export type Env = z.infer<typeof schema>;

let cached: Env | null = null;

export function env(): Env {
  if (cached) return cached;
  const parsed = schema.safeParse(process.env);
  if (!parsed.success) {
    const missing = parsed.error.issues.map((i) => i.path.join(".")).join(", ");
    throw new Error(`Environment is incomplete or invalid: ${missing}`);
  }
  cached = parsed.data;
  return cached;
}
