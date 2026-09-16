import { Pool, neon } from "@neondatabase/serverless";
import { drizzle as drizzleServerless } from "drizzle-orm/neon-serverless";
import { drizzle as drizzleHttp } from "drizzle-orm/neon-http";
import { env } from "@/lib/env";
import * as schema from "./schema";

/**
 * Two clients from the same package, on purpose.
 *
 * dbPool runs over a WebSocket connection pool. It is the only client where
 * db.transaction() is a real transaction, so ingest, dedupe and anything that
 * takes a lock uses it. Needs a global WebSocket, which Node 22 and later and
 * the Vercel runtime provide.
 *
 * dbHttp is one HTTP round trip per query with no session. It is the cheap
 * choice for request path reads and single statement writes.
 */
const g = globalThis as unknown as { __jobluvoPool?: Pool };

function pool(): Pool {
  if (!g.__jobluvoPool) {
    g.__jobluvoPool = new Pool({ connectionString: env().DATABASE_URL });
  }
  return g.__jobluvoPool;
}

export const dbPool = () => drizzleServerless({ client: pool(), schema });

export const dbHttp = () => drizzleHttp({ client: neon(env().DATABASE_URL), schema });

export type DbPool = ReturnType<typeof dbPool>;
export type DbHttp = ReturnType<typeof dbHttp>;
export type Tx = Parameters<Parameters<DbPool["transaction"]>[0]>[0];
