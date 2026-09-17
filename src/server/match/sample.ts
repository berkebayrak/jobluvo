import { sql } from "drizzle-orm";
import type { DbPool, Tx } from "@/db/client";
import { withRep } from "@/server/jobs/feed";
import { hardFilterSql, type FilterFacts } from "@/server/match/hardFilter";

/*
 * The stratified sample behind every phase 0 measurement (D-003): the
 * user's passing feed representatives, drawn round robin over cells of
 * family, seniority and description length with a fixed seed, so the
 * scoring sample and the tailoring sample are the same 100 jobs and the
 * two numbers can be read together.
 *
 * The cells are visited family by family in turn, not in alphabetical
 * order: with 67 cells and a 20 job draw, alphabetical order took the
 * first 20 cells and every one was Ashby's, so four fresh samples on 18
 * September 2026 fell in one family (D-023, review three finding 17). The
 * candidates are read in id order so the same seed draws the same jobs
 * from the same feed. A run's chosen jobs are on record as the distinct
 * jobs of its cost rows, by run tag.
 */

export const SAMPLE_SEED = 20260917;

/** Deterministic shuffle: mulberry32 over the seed, Fisher Yates over the list. */
export function shuffle<T>(xs: T[], seed: number): T[] {
  let a = seed >>> 0;
  const rand = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const out = [...xs];
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rand() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

export const lengthBucket = (n: number) => (n < 2500 ? "short" : n < 5000 ? "medium" : "long");

export interface Sample {
  chosen: string[];
  candidates: number;
  cells: { cell: string; candidates: number; sampled: number }[];
  /** The chosen jobs by family. */
  byFamily: Record<string, number>;
}

/** Cell keys "family|seniority|length" reordered so consecutive cells rotate families: the i-th cell of each family in turn. */
export function rotateByFamily(keys: string[]): string[] {
  const byFamily = new Map<string, string[]>();
  for (const k of [...keys].sort()) {
    const f = k.split("|")[0];
    (byFamily.get(f) ?? byFamily.set(f, []).get(f)!).push(k);
  }
  const families = [...byFamily.keys()].sort();
  const out: string[] = [];
  for (let i = 0; ; i += 1) {
    let any = false;
    for (const f of families) {
      const k = byFamily.get(f)![i];
      if (k) {
        out.push(k);
        any = true;
      }
    }
    if (!any) return out;
  }
}

export async function stratifiedSample(db: DbPool | Tx, userId: string, facts: FilterFacts, n: number): Promise<Sample> {
  const cand = await db.execute<{ id: string; family: string; seniority: string | null; len: number }>(sql`
    ${withRep(userId, hardFilterSql(facts))}
    select j.id, j.family::text as family, j.seniority, length(j.description_core)::int as len
    from rep join jobs j on j.id = rep.id
    where rep.reason is null and j.description_core <> ''
    order by j.id
  `);
  const cells = new Map<string, string[]>();
  for (const r of cand.rows) {
    const key = `${r.family}|${r.seniority ?? "not stated"}|${lengthBucket(r.len)}`;
    (cells.get(key) ?? cells.set(key, []).get(key)!).push(r.id);
  }
  const keys = rotateByFamily([...cells.keys()]);
  const queues = keys.map((k) => shuffle(cells.get(k)!, SAMPLE_SEED + k.length));
  const chosen: string[] = [];
  const perCell = new Map<string, number>();
  for (let round = 0; chosen.length < n; round += 1) {
    let any = false;
    for (let i = 0; i < keys.length && chosen.length < n; i += 1) {
      const id = queues[i][round];
      if (!id) continue;
      any = true;
      chosen.push(id);
      perCell.set(keys[i], (perCell.get(keys[i]) ?? 0) + 1);
    }
    if (!any) break;
  }
  const byFamily: Record<string, number> = {};
  for (const [k, n] of perCell) byFamily[k.split("|")[0]] = (byFamily[k.split("|")[0]] ?? 0) + n;
  return {
    chosen,
    candidates: cand.rows.length,
    cells: [...keys].sort().map((k) => ({ cell: k, candidates: cells.get(k)!.length, sampled: perCell.get(k) ?? 0 })),
    byFamily,
  };
}
