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

/**
 * The mark an evicted pooled client prints, so a connection dying is
 * searchable in the log rather than silent.
 */
export const POOL_CLIENT_EVICTED = "POOL_CLIENT_EVICTED";

/**
 * How long a pooled websocket may live before it is retired on release.
 * Neon's proxy closes a connection that has been up a while, and a client
 * whose socket the proxy has already closed is a client that fails the next
 * time it is used. Retiring at four minutes keeps the pool's connections
 * younger than that, so the pool decides when a connection ends rather than
 * discovering it mid query.
 */
const MAX_CLIENT_LIFETIME_SECONDS = 240;

/*
 * The pool is a module global and is reused, which is the point: on Vercel
 * it survives between invocations and a new user's request borrows a
 * connection somebody else's request opened. That is also what made a dead
 * client dangerous. It was created with no error handler and no recycling,
 * so a websocket the proxy had dropped stayed in the pool and was handed to
 * whatever asked next, which failed with "Client has encountered a
 * connection error and is not queryable". In a test that is a rerun; in
 * production it is a 500 in front of a person, and the request that pays
 * for it is not the one that broke the connection.
 *
 * Two lines fix it, and neither changes how anything connects.
 *
 * An error handler. Without a listener on the pool, an idle client whose
 * socket dies emits "error" on an emitter nobody is listening to, which
 * Node turns into an uncaught exception. With one, the client is removed
 * from the pool before it can be handed out, and the eviction is printed.
 *
 * A lifetime. A connection is retired on release once it is older than the
 * cap, so the pool rotates its connections before the proxy closes them
 * underneath it.
 */
export function createPool(connectionString: string): Pool {
  const created = new Pool({ connectionString, maxLifetimeSeconds: MAX_CLIENT_LIFETIME_SECONDS });
  created.on("error", (err: Error) => {
    // The client is already out of the pool by the time this runs; this is the record that it happened.
    console.error(`${POOL_CLIENT_EVICTED}: a pooled connection died and was removed before it could be reused: ${err.message}`);
  });
  return created;
}

/**
 * The one pool the application uses. Construction is `createPool` above so a
 * test can build an identical one of its own: proving eviction means killing
 * connections, and killing connections in the pool every other test shares is
 * how a fix for flakiness becomes a cause of it.
 */
function pool(): Pool {
  if (!g.__jobluvoPool) g.__jobluvoPool = createPool(env().DATABASE_URL);
  return g.__jobluvoPool;
}

export const dbPool = () => drizzleServerless({ client: pool(), schema });

export const dbHttp = () => drizzleHttp({ client: neon(env().DATABASE_URL), schema });

export type DbPool = ReturnType<typeof dbPool>;
export type DbHttp = ReturnType<typeof dbHttp>;
export type Tx = Parameters<Parameters<DbPool["transaction"]>[0]>[0];
