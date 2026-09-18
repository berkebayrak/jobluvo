import type { DbPool, Tx } from "@/db/client";
import { costEvents } from "@/db/schema";

/*
 * Writing a row to the cost worksheet, which may fail without taking the
 * work down with it (review four, finding 16).
 *
 * The worksheet is a record of what was spent. It is not the operation. A
 * tailored resume that has been paid for, validated and is ready to store
 * must not be thrown away because the row recording its price could not be
 * written, and an extraction must not leave its document stuck in
 * "processing" for the same reason. Before this, every insert was awaited
 * bare:
 *
 * - on the success paths, a failed insert threw out of the run and the
 *   packet or the facts were never stored at all, so a paid call produced
 *   nothing and left no cost row either;
 * - on the error paths, where the insert records the price of a call that
 *   had already failed, a failed insert replaced the original error with
 *   its own. The reason the call failed, a timeout, a refusal, a parse
 *   error, was lost and the row was marked failed with the wrong message.
 *
 * So the write is attempted, and a failure is reported and swallowed. The
 * loss is never silent: it prints a line beginning with COST_NOT_RECORDED
 * carrying the kind, the reference and the amount, so what the worksheet
 * is missing can be reconstructed from the log.
 *
 * What this does not do, stated because the opposite would be easy to
 * assume. It cannot rescue an insert that fails inside an enclosing
 * transaction at the database itself: Postgres puts the whole transaction
 * into a failed state, and every statement after it fails too. What it
 * protects against is an insert that fails on its own, which is the case
 * on the pooled path where each insert stands alone.
 *
 * A missing row is also detectable after the fact rather than only in the
 * log: a packet stores the total it spent, so `npm run reconcile-sample`
 * reports any packet whose cost rows do not count its attempts or do not
 * sum to the total it carries.
 */

/** The mark a dropped cost row prints, so the log can be searched for what the worksheet is missing. */
export const COST_NOT_RECORDED = "COST_NOT_RECORDED";

/**
 * Writes one cost row. Never throws: a worksheet that cannot be written
 * does not stop the work being paid for.
 *
 * @returns true when the row was written, false when it was reported and dropped
 */
export async function recordCost(db: DbPool | Tx, values: typeof costEvents.$inferInsert): Promise<boolean> {
  try {
    await db.insert(costEvents).values(values);
    return true;
  } catch (e) {
    const why = e instanceof Error ? e.message : String(e);
    console.error(`${COST_NOT_RECORDED} kind=${values.kind} ref=${values.refId ?? "none"} model=${values.model ?? "none"} usd=${values.usd ?? 0} ms=${values.ms ?? 0}: ${why}`);
    return false;
  }
}
