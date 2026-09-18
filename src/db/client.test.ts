import type { Pool, PoolClient } from "@neondatabase/serverless";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { createPool, POOL_CLIENT_EVICTED } from "./client";

/*
 * The pool hands out live connections, not dead ones (review five).
 *
 * The pool is a module global and is reused, which on Vercel means it
 * survives between invocations and a new request borrows a connection an
 * earlier one opened. With no error handler it kept a websocket the proxy
 * had already dropped and handed it to whatever asked next, which failed
 * with "Client has encountered a connection error and is not queryable".
 * The test suite is only where that was noticed; in production the request
 * that pays for it is not the one that broke the connection.
 *
 * So the proof here is the one the check chain got: break a client on
 * purpose and show the pool does not give it to the next caller.
 *
 * On its own pool, built by the same function the application's is built by.
 * Killing connections in the pool every other test file shares is how a fix
 * for flakiness becomes a cause of it, which this test did before it owned
 * its own.
 */

const hasDb = !!process.env.DATABASE_URL;

let own: Pool | null = null;
const handle = () => own!;

describe.skipIf(!hasDb)("the pooled connection", () => {
  beforeAll(async () => {
    own = createPool(process.env.DATABASE_URL!);
    await own.query("select 1");
  });

  afterAll(async () => {
    await own?.end();
    own = null;
  });

  it("evicts a connection that dies while idle, says so, and never hands it to the next caller", async () => {
    const errors = vi.spyOn(console, "error").mockImplementation(() => {});
    const pool = handle();
    const dying = await pool.connect();
    dying.release();
    const idleBefore = pool.idleCount;
    expect(idleBefore).toBeGreaterThan(0);

    // Exactly what the proxy does to a connection it has finished with, and what produced the error we caught:
    // the socket dies while the client sits in the pool between two requests.
    (dying as unknown as { emit(event: string, err: Error): boolean }).emit(
      "error",
      new Error("Client has encountered a connection error and is not queryable"),
    );

    // Gone from the pool, not waiting in it. Without the handler this line never runs: Node makes an
    // unlistened "error" event an uncaught exception and takes the process with it.
    expect(pool.idleCount).toBe(idleBefore - 1);
    expect(errors.mock.calls.flat().join(" ")).toContain(POOL_CLIENT_EVICTED);

    // The next caller gets a working connection, and not that one.
    const next = await pool.connect();
    expect(next).not.toBe(dying);
    const r = await next.query("select 1 as one");
    expect(Number(r.rows[0].one)).toBe(1);
    next.release();
    errors.mockRestore();
  });

  it("keeps serving queries after an eviction, so one dead connection is not an outage", async () => {
    const errors = vi.spyOn(console, "error").mockImplementation(() => {});
    const pool = handle();
    const casualties: PoolClient[] = [];
    for (let i = 0; i < 3; i += 1) {
      const c = await pool.connect();
      c.release();
      (c as unknown as { emit(event: string, err: Error): boolean }).emit("error", new Error("connection terminated unexpectedly"));
      casualties.push(c);
    }
    expect(errors.mock.calls.flat().join(" ").match(/POOL_CLIENT_EVICTED/g)).toHaveLength(3);
    // Three connections died and the pool is still usable.
    const r = await pool.query("select 2 as two");
    expect(Number(r.rows[0].two)).toBe(2);
    errors.mockRestore();
  });

  it("retires a connection on a lifetime, so the pool ends a connection before the proxy does", async () => {
    // Not a behaviour worth faking a four minute clock for; what is worth asserting is that the cap is set,
    // since a pool with no lifetime is the state this fixes and it is one edit away from returning.
    const options = handle().options as unknown as { maxLifetimeSeconds?: number };
    expect(options.maxLifetimeSeconds).toBe(240);
  });
});
