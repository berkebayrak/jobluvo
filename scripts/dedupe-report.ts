import { sql } from "drizzle-orm";
import type { JobLocation } from "@/db/schema";
import { dbHttp } from "@/db/client";
import { env } from "@/lib/env";
import { locationsOverlap, REQUISITION_FANOUT, type LocJob } from "@/server/jobs/identity";

/**
 * What a dedupe rule change releases and what it withholds, measured over
 * every pair in similarity_log before the rule ships. `npm run dedupe-report`.
 *
 * Two rules are under test. The location rule, which now compares the country
 * and treats remote as possibly country restricted, and the requisition rule,
 * which refuses a similarity merge when both postings carry a requisition id
 * and the ids differ. Neither can be judged from its own description: the
 * location rule is stricter for remote and looser for country only postings
 * at the same time, so the only honest answer is the count on both sides.
 */

/** The rule as it stood before pass three, kept here so any later change can be measured the same way. */
function legacyLocationsOverlap(a: LocJob, b: LocJob): boolean {
  const aRemote = a.workplace === "remote" || a.locations.some((l) => l.remote);
  const bRemote = b.workplace === "remote" || b.locations.some((l) => l.remote);
  if (aRemote && bRemote) return true;
  const key = (l: JobLocation) => (l.city ?? l.region ?? l.country ?? l.raw).toLowerCase();
  const set = new Set(a.locations.map(key));
  return b.locations.some((l) => set.has(key(l)));
}

interface Side {
  id: string;
  company: string;
  title: string;
  family: string;
  workplace: string;
  locations: JobLocation[];
  requisitionId: string | null;
  fanout: number;
}

interface Pair {
  score: number;
  merged: boolean;
  a: Side;
  b: Side;
}

const place = (s: Side) => {
  const ls = s.locations.map((l) => l.raw).join(" / ") || "(none)";
  return `${s.workplace}: ${ls}`;
};

const show = (p: Pair) => ({
  company: p.a.company,
  title: p.a.title.slice(0, 34),
  score: Math.round(p.score * 1000) / 1000,
  a: place(p.a).slice(0, 40),
  b: place(p.b).slice(0, 40),
});

/** Which rung of the new rule let a pair through, for the released pairs. */
function rung(p: Pair): string {
  const aRemote = p.a.workplace === "remote" || p.a.locations.some((l) => l.remote);
  const bRemote = p.b.workplace === "remote" || p.b.locations.some((l) => l.remote);
  if (aRemote && bRemote) return "both remote";
  for (const la of p.a.locations) {
    for (const lb of p.b.locations) {
      const ca = la.country?.toUpperCase();
      const cb = lb.country?.toUpperCase();
      if (ca && cb && ca !== cb) continue;
      const cityA = la.city?.trim().toLowerCase();
      const cityB = lb.city?.trim().toLowerCase();
      if (cityA && cityB) {
        if (cityA === cityB) return "same city";
        continue;
      }
      const regionA = la.region?.trim().toLowerCase();
      const regionB = lb.region?.trim().toLowerCase();
      if (regionA && regionB) {
        if (regionA === regionB) return "same region";
        continue;
      }
      if (ca && cb) return "same country, one side names no city";
      if (la.raw.trim().toLowerCase() === lb.raw.trim().toLowerCase()) return "same raw string";
    }
  }
  return "(none)";
}

/** A requisition id that identifies one requisition: carries a digit, short, and not shared by a crowd. */
const realRequisition = (s: Side) =>
  !!s.requisitionId && /[0-9]/.test(s.requisitionId) && s.requisitionId.length <= 40 && s.fanout <= REQUISITION_FANOUT;

async function main() {
  const db = dbHttp();
  const threshold = env().SIMILARITY_THRESHOLD;

  const rows = (
    await db.execute<Record<string, unknown>>(sql`
      select l.score, l.merged,
             a.id as a_id, a.company_name as a_company, a.title as a_title, a.workplace as a_workplace,
             a.locations as a_locations, a.requisition_id as a_req, sa.family as a_family,
             (select count(*) from jobs x where x.company_domain = a.company_domain
                and x.requisition_id = a.requisition_id and x.closed_at is null)::int as a_fanout,
             b.id as b_id, b.company_name as b_company, b.title as b_title, b.workplace as b_workplace,
             b.locations as b_locations, b.requisition_id as b_req, sb.family as b_family,
             (select count(*) from jobs x where x.company_domain = b.company_domain
                and x.requisition_id = b.requisition_id and x.closed_at is null)::int as b_fanout
      from similarity_log l
      join jobs a on a.id = l.job_a join sources sa on sa.id = a.source_id
      join jobs b on b.id = l.job_b join sources sb on sb.id = b.source_id`)
  ).rows;

  const side = (r: Record<string, unknown>, k: "a" | "b"): Side => ({
    id: String(r[`${k}_id`]),
    company: String(r[`${k}_company`]),
    title: String(r[`${k}_title`]),
    family: String(r[`${k}_family`]),
    workplace: String(r[`${k}_workplace`]),
    locations: (r[`${k}_locations`] ?? []) as JobLocation[],
    requisitionId: (r[`${k}_req`] as string) ?? null,
    fanout: Number(r[`${k}_fanout`]),
  });
  const pairs: Pair[] = rows.map((r) => ({
    score: Number(r.score),
    merged: Boolean(r.merged),
    a: side(r, "a"),
    b: side(r, "b"),
  }));

  const atScore = pairs.filter((p) => p.score >= threshold);
  console.log(`similarity_log: ${pairs.length} pairs, ${pairs.filter((p) => p.merged).length} merged, threshold ${threshold}\n`);

  console.log("every logged pair, by what decided it under the rule as it stands");
  console.table([
    { group: `below the threshold (< ${threshold})`, pairs: pairs.length - atScore.length },
    { group: "at the threshold, merged", pairs: atScore.filter((p) => p.merged).length },
    {
      group: "at the threshold, not merged, fails the location test",
      pairs: atScore.filter((p) => !p.merged && !legacyLocationsOverlap(p.a, p.b)).length,
    },
    {
      group: "at the threshold, not merged, location passes (job already claimed by an earlier candidate)",
      pairs: atScore.filter((p) => !p.merged && legacyLocationsOverlap(p.a, p.b)).length,
    },
  ]);

  // 1. What the new location rule does to the pairs that fail only on location.
  const failedOnLocation = atScore.filter((p) => !p.merged && !legacyLocationsOverlap(p.a, p.b));
  const released = failedOnLocation.filter((p) => locationsOverlap(p.a, p.b));
  const stillApart = failedOnLocation.filter((p) => !locationsOverlap(p.a, p.b));
  console.log(`\n1. the ${failedOnLocation.length} pairs at or above ${threshold} that fail only the location test`);
  console.table([
    { outcome: "would now merge", pairs: released.length },
    { outcome: "still apart", pairs: stillApart.length },
  ]);

  if (released.length) {
    const byRung = new Map<string, number>();
    for (const p of released) {
      const r = rung(p);
      byRung.set(r, (byRung.get(r) ?? 0) + 1);
    }
    console.log("what let the released pairs through");
    console.table([...byRung.entries()].map(([r, pairs]) => ({ rung: r, pairs })).sort((x, y) => y.pairs - x.pairs));
    console.log("released, highest scoring first");
    console.table(
      released
        .slice()
        .sort((x, y) => y.score - x.score)
        .slice(0, 8)
        .map(show),
    );
  }
  console.log("still apart, highest scoring first (read these as the possible misses)");
  console.table(
    stillApart
      .slice()
      .sort((x, y) => y.score - x.score)
      .slice(0, 8)
      .map(show),
  );

  // 2. The other direction: the new rule is stricter for remote, so it can withhold a merge that exists today.
  const mergedNow = atScore.filter((p) => p.merged);
  const withheld = mergedNow.filter((p) => !locationsOverlap(p.a, p.b));
  console.log(`\n2. the ${mergedNow.length} pairs merged today, under the same new rule`);
  console.table([
    { outcome: "still merge", pairs: mergedNow.length - withheld.length },
    { outcome: "the new rule would withhold", pairs: withheld.length },
  ]);
  if (withheld.length)
    console.table(
      withheld
        .slice()
        .sort((x, y) => y.score - x.score)
        .slice(0, 8)
        .map(show),
    );

  // 3. The requisition id rule, against the links that exist today.
  const bothIds = mergedNow.filter((p) => p.a.requisitionId && p.b.requisitionId);
  const differ = bothIds.filter((p) => p.a.requisitionId !== p.b.requisitionId);
  const guarded = differ.filter((p) => realRequisition(p.a) && realRequisition(p.b));
  console.log(`\n3. the requisition id rule against the ${mergedNow.length} similarity merges that exist today`);
  console.table([
    { case: "both sides carry a requisition id", pairs: bothIds.length },
    { case: "and the ids differ, so a bare rule refuses the merge", pairs: differ.length },
    { case: "and both ids survive the placeholder guards, so the rule refuses", pairs: guarded.length },
    { case: "refused by the bare rule but saved by the guards", pairs: differ.length - guarded.length },
  ]);
  if (differ.length)
    console.table(
      differ
        .slice()
        .sort((x, y) => y.score - x.score)
        .slice(0, 8)
        .map((p) => ({
          ...show(p),
          boards: p.a.family === p.b.family ? p.a.family : `${p.a.family} vs ${p.b.family}`,
          "a req": `${p.a.requisitionId} (${p.a.fanout} open)`,
          "b req": `${p.b.requisitionId} (${p.b.fanout} open)`,
          "guards keep it": !(realRequisition(p.a) && realRequisition(p.b)),
        })),
    );

  // Same board or not. Two ids from one board are the employer's own numbering,
  // two ids from different boards may be two schemes and are weaker evidence.
  console.log("the differing id pairs, by whether both sides came from the same board");
  const sameBoard = differ.filter((p) => p.a.family === p.b.family);
  console.table([
    { case: "same family", pairs: sameBoard.length },
    { case: "different families", pairs: differ.length - sameBoard.length },
  ]);

  // 4. Do the two rules cover the same pairs, or different ones.
  const key = (p: Pair) => [p.a.id, p.b.id].sort().join("|");
  const byLocation = new Set(withheld.map(key));
  const byReq = new Set(guarded.map(key));
  const union = new Set([...byLocation, ...byReq]);
  const both = [...byLocation].filter((k) => byReq.has(k));
  console.log(`\n4. the two rules against the ${mergedNow.length} merges that exist today, counted as pairs`);
  console.table([
    { case: "the location rule alone would withhold", pairs: byLocation.size - both.length },
    { case: "the requisition rule alone would refuse", pairs: byReq.size - both.length },
    { case: "both rules say no", pairs: both.length },
    { case: "neither, the merge stands", pairs: mergedNow.length - union.size },
  ]);
  console.log(
    `${union.size} of ${mergedNow.length} similarity merges would not be made again. Nothing splits an existing group, so these stay merged until a split path exists.`,
  );
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
