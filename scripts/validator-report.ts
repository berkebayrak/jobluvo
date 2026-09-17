import { and, eq, inArray, sql } from "drizzle-orm";
import { dbPool } from "@/db/client";
import { packets, profileFacts, type PacketFinding } from "@/db/schema";
import { buildResumeFacts, type FactRow, type ResumeFacts } from "@/server/match/profile";
import { baseResume, factEntries, resumeHash } from "@/server/packet/resume";
import { factSet, validateChangeSet } from "@/server/packet/validate";

/**
 * What the claim validator says about every packet on hand. Each packet's
 * stored change set is validated again, against the facts the packet was
 * built on: the profile whose hash the packet carries, rebuilt from the
 * rows confirmed then, or the packet is excluded and counted. Summaries
 * are not replayed; the stored packet keeps its bullet changes, not the
 * summary's citations (D-016), so a summary's old findings are kept.
 *
 *   npm run validator-report            the measurement, nothing written
 *   npm run validator-report -- --apply the same, then every replayed packet
 *                                       restamped: status, findings and,
 *                                       for a packet that fails today, no
 *                                       resume
 *
 * The status column means "passes the rules as they stand" (D-017). When a
 * rule changes, this runs first as the measurement and then with --apply,
 * so no row keeps a word today's validator would not give it behind the
 * one function that trusts that word.
 */

type Level = PacketFinding["level"];

function count<T extends string>(xs: T[]): Record<string, number> {
  const m: Record<string, number> = {};
  for (const x of xs) m[x] = (m[x] ?? 0) + 1;
  return Object.fromEntries(Object.entries(m).sort((a, b) => b[1] - a[1]));
}

/** The fact sets that reproduce a hash: the profile as confirmed now, or the profile the seeded user facts made before the upload replaced them. */
async function candidateProfiles(db: ReturnType<typeof dbPool>, userId: string): Promise<{ name: string; facts: ResumeFacts }[]> {
  const rows = await db
    .select({ id: profileFacts.id, kind: profileFacts.kind, data: profileFacts.data, origin: profileFacts.origin, evidence: profileFacts.evidence, status: profileFacts.status })
    .from(profileFacts)
    .where(and(eq(profileFacts.userId, userId), inArray(profileFacts.kind, ["preference", "employment", "education", "skill", "answer"])));
  const asRows = (xs: typeof rows): FactRow[] => xs.map((r) => ({ id: r.id, kind: r.kind, data: r.data, origin: r.origin, evidence: r.evidence }));
  const prefs = rows.filter((r) => r.kind === "preference" && r.status === "confirmed");
  const out: { name: string; facts: ResumeFacts }[] = [];
  const now = buildResumeFacts(userId, asRows(rows.filter((r) => r.status === "confirmed")));
  if (now) out.push({ name: "confirmed now", facts: now });
  // Every retired set by origin: the seeded user facts, and any earlier upload, each with the current preference.
  for (const origin of ["user", "upload", "edit"] as const) {
    const retired = rows.filter((r) => r.status === "rejected" && r.origin === origin && r.kind !== "preference");
    if (!retired.length) continue;
    const facts = buildResumeFacts(userId, asRows([...prefs, ...retired]));
    if (facts) out.push({ name: `retired ${origin} facts`, facts });
  }
  return out;
}

async function main() {
  const db = dbPool();
  const rows = await db.select().from(packets);
  const byUser = new Map<string, typeof rows>();
  for (const p of rows) byUser.set(p.userId, [...(byUser.get(p.userId) ?? []), p]);

  const apply = process.argv.includes("--apply");
  const perPacket: { id: string; run: string; status: string; hard: PacketFinding[]; review: PacketFinding[]; soft: PacketFinding[]; edits: number; would: string; findings: PacketFinding[]; old: PacketFinding[] }[] = [];
  let excluded = 0;
  const profilesUsed: Record<string, number> = {};
  for (const [userId, ps] of byUser) {
    const candidates = await candidateProfiles(db, userId);
    for (const p of ps) {
      const match = candidates.find((c) => c.facts.factsHash === p.factsHash);
      if (!match) {
        excluded += 1;
        continue;
      }
      profilesUsed[match.name] = (profilesUsed[match.name] ?? 0) + 1;
      const entries = factEntries(match.facts);
      const set = factSet(entries);
      const base = baseResume(match.facts);
      const findings = validateChangeSet({ summary: null, summaryFacts: [], changes: p.changes, skills: [] }, base, set);
      const by = (l: Level) => findings.filter((f) => f.level === l);
      const hard = by("hard");
      const review = by("review");
      const would = hard.length ? "invalid" : review.length ? "needs_review" : "ready";
      perPacket.push({ id: p.id, run: p.run ?? "product", status: p.status, hard, review, soft: by("soft"), edits: p.changes.length, would, findings, old: p.findings });
    }
  }

  if (apply) {
    let restamped = 0;
    for (const p of perPacket) {
      // The summary cannot be replayed: its old findings are kept beside the replayed bullet findings.
      const findings = [...p.findings, ...p.old.filter((f) => f.bullet === "summary")];
      const [row] = await db.select({ resume: packets.resume, status: packets.status }).from(packets).where(eq(packets.id, p.id));
      const resume = p.would === "invalid" ? null : row.resume;
      await db
        .update(packets)
        .set({ status: p.would as "ready" | "needs_review" | "invalid", findings, resume, resumeHash: resume ? resumeHash(resume) : null, updatedAt: sql`now()` })
        .where(eq(packets.id, p.id));
      if (row.status !== p.would) restamped += 1;
    }
    console.log(`\napplied: ${perPacket.length} packets restamped under the rules as they stand, ${restamped} changed status`);
  }

  const edits = perPacket.reduce((a, p) => a + p.edits, 0);
  console.log(`packets on hand ${rows.length}, replayed ${perPacket.length} (${edits} bullet edits), excluded ${excluded} whose facts hash no profile on hand reproduces`);
  console.log("profiles the packets were built on:", JSON.stringify(profilesUsed));

  console.log("\noutcome today against outcome under the claim validator, packets");
  const grid: Record<string, Record<string, number>> = {};
  for (const p of perPacket) {
    grid[p.status] ??= {};
    grid[p.status][p.would] = (grid[p.status][p.would] ?? 0) + 1;
  }
  console.table(grid);
  const readyToday = perPacket.filter((p) => p.status === "ready");
  const heldOfReady = readyToday.filter((p) => p.would === "needs_review").length;
  const invalidOfReady = readyToday.filter((p) => p.would === "invalid").length;
  console.log(
    `of ${readyToday.length} packets ready today: ${heldOfReady} would be held for review (${readyToday.length ? ((100 * heldOfReady) / readyToday.length).toFixed(1) : "0"} percent), ${invalidOfReady} would be invalid (${readyToday.length ? ((100 * invalidOfReady) / readyToday.length).toFixed(1) : "0"} percent)`,
  );

  console.log("\nhard findings by reason, edits");
  console.table(count(perPacket.flatMap((p) => p.hard.map((f) => f.message.replace(/: .*$/, "")))));
  console.log("hard findings, the contradictions named");
  console.table(count(perPacket.flatMap((p) => p.hard.filter((f) => f.message.startsWith("value does not mean")).map((f) => f.message.replace(/^.*?: /, "")))));

  console.log("\nreview findings by reason, edits");
  const reviewKind = (f: PacketFinding) => (f.message.startsWith("name") ? (f.detail === "sentence initial" ? "name, sentence initial" : "name") : f.message.startsWith("the fact and the line") ? "metric words differ" : "metric unreadable");
  console.table(count(perPacket.flatMap((p) => p.review.map(reviewKind))));
  console.log("packets held for review by the reasons that hold them");
  console.table(count(perPacket.filter((p) => p.would === "needs_review").map((p) => [...new Set(p.review.map(reviewKind))].sort().join(" + "))));

  console.log("\nsoft findings by reason, edits");
  console.table(count(perPacket.flatMap((p) => p.soft.map((f) => f.message))));

  const sample = (label: string, pick: (f: PacketFinding) => boolean, n = 12) => {
    const xs = perPacket.flatMap((p) => p.review.filter(pick).map((f) => `${f.value ?? ""}  |  ${f.detail ?? ""}`));
    console.log(`\n${label}: ${xs.length} in all, first ${Math.min(n, xs.length)}`);
    for (const x of [...new Set(xs)].slice(0, n)) console.log("  " + x);
  };
  sample("metric words differ, fact against line", (f) => f.message.startsWith("the fact and the line"));
  sample("metric unreadable, fact against line", (f) => f.message.includes("could not be read"));
  console.log("\nsentence initial names in no fact, by word, edits");
  console.table(count(perPacket.flatMap((p) => p.review.filter((f) => f.detail === "sentence initial").map((f) => String(f.value)))));
  console.log("other names in no fact, by name, edits");
  console.table(count(perPacket.flatMap((p) => p.review.filter((f) => f.message.startsWith("name") && f.detail !== "sentence initial").map((f) => String(f.value)))));
  const hardSample = perPacket.flatMap((p) => p.hard.map((f) => `${f.bullet}  ${f.message}${f.value ? ` (${f.value})` : ""}  ${f.detail ?? ""}`));
  console.log(`\nhard, first ${Math.min(12, hardSample.length)} of ${hardSample.length}`);
  for (const x of [...new Set(hardSample)].slice(0, 12)) console.log("  " + x);
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
