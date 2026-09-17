import { and, eq, inArray, sql } from "drizzle-orm";
import { dbPool } from "@/db/client";
import { packets, profileFacts, type PacketFinding } from "@/db/schema";
import { buildResumeFacts, type FactRow, type ResumeFacts } from "@/server/match/profile";
import { applyReplay, replayDecision, type ReplayDecision, type ReplayRow } from "@/server/packet/replay";
import { applyChanges, baseResume, factEntries, resumeHash } from "@/server/packet/resume";
import { factSet, validateChangeSet } from "@/server/packet/validate";

/**
 * What the claim validator says about every packet on hand. Each packet's
 * stored change set is validated again, against the facts the packet was
 * built on: the profile whose hash the packet carries, rebuilt from the
 * rows confirmed then, or the packet is excluded and counted. Summaries
 * are not replayed; the stored packet keeps its bullet changes, not the
 * summary's citations (D-016), so a summary's old findings are kept and
 * counted into the status beside the replayed ones.
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
 * one function that trusts that word. What a row may be stamped with is
 * decided in src/server/packet/replay.ts: the status comes from every
 * finding the row will carry, a failed packet is not replayed, and nothing
 * without its validated resume is stamped ready.
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

/** The column a packet lands in: the status it would be stamped with, or why it is not stamped. */
function outcomeOf(d: ReplayDecision | "excluded"): string {
  if (d === "excluded") return "excluded, no profile reproduces the hash";
  if (d.kind === "restamp") return d.status;
  if (d.kind === "no_candidate") return "not replayed, failed, no candidate";
  return `not promoted, passes as ${d.would} but no resume stored`;
}

async function main() {
  const db = dbPool();
  const rows = await db
    .select({
      id: packets.id,
      userId: packets.userId,
      status: packets.status,
      run: packets.run,
      mode: packets.mode,
      resume: packets.resume,
      resumeHash: packets.resumeHash,
      changes: packets.changes,
      findings: packets.findings,
      factsHash: packets.factsHash,
      error: packets.error,
      updatedAt: sql<string>`${packets.updatedAt}::text`,
    })
    .from(packets);
  const byUser = new Map<string, typeof rows>();
  for (const p of rows) byUser.set(p.userId, [...(byUser.get(p.userId) ?? []), p]);

  const apply = process.argv.includes("--apply");
  const perPacket: { row: ReplayRow; run: string; status: string; edits: number; decision: ReplayDecision | "excluded"; findings: PacketFinding[]; outcome: string; hashHolds: boolean | null }[] = [];
  const profilesUsed: Record<string, number> = {};
  for (const [userId, ps] of byUser) {
    const candidates = await candidateProfiles(db, userId);
    for (const p of ps) {
      const row: ReplayRow = { id: p.id, status: p.status, resume: p.resume, resumeHash: p.resumeHash, findings: p.findings, updatedAt: p.updatedAt };
      const match = candidates.find((c) => c.facts.factsHash === p.factsHash);
      if (!match) {
        perPacket.push({ row, run: p.run ?? "product", status: p.status, edits: p.changes.length, decision: "excluded", findings: p.findings, outcome: outcomeOf("excluded"), hashHolds: null });
        continue;
      }
      profilesUsed[match.name] = (profilesUsed[match.name] ?? 0) + 1;
      const entries = factEntries(match.facts);
      const set = factSet(entries);
      const base = baseResume(match.facts);
      const replayed = validateChangeSet({ summary: null, summaryFacts: [], changes: p.changes, skills: [] }, base, set);
      // The candidate the stored changes describe: the base plus the changes, with the summary the stored resume carries. The decision stamps ready only a resume that is this document.
      const candidate = p.resume ? applyChanges(base, { summary: p.resume.summary, summaryFacts: [], changes: p.changes, skills: [] }).resume : null;
      const decision = replayDecision(row, replayed, candidate);
      const findings = decision.kind === "no_candidate" ? p.findings : decision.findings;
      const hashHolds = p.resume ? resumeHash(p.resume) === p.resumeHash : null;
      perPacket.push({ row, run: p.run ?? "product", status: p.status, edits: p.changes.length, decision, findings, outcome: outcomeOf(decision), hashHolds });
    }
  }
  const replayed = perPacket.filter((p) => p.decision !== "excluded");

  if (apply) {
    const result = await applyReplay(
      db,
      replayed.map((p) => ({ row: p.row, decision: p.decision as ReplayDecision })),
    );
    console.log(
      `\napplied: ${result.restamped} packets restamped under the rules as they stand, ${result.changedStatus} changed status, ${result.untouched} left as they are (no candidate or no resume), ${result.stale} refused because the row moved since it was read`,
    );
  }

  const edits = replayed.reduce((a, p) => a + p.edits, 0);
  const excluded = perPacket.length - replayed.length;
  console.log(`packets on hand ${rows.length}, replayed ${replayed.length} (${edits} bullet edits), excluded ${excluded} whose facts hash no profile on hand reproduces`);
  console.log("profiles the packets were built on:", JSON.stringify(profilesUsed));
  const withResume = perPacket.filter((p) => p.hashHolds !== null);
  const candidates = replayed.filter((p) => p.decision !== "excluded" && p.decision.kind === "restamp" && p.decision.resume).length;
  const noResume = replayed.filter((p) => p.decision !== "excluded" && p.decision.kind === "no_resume").length;
  console.log(
    `stored resumes: ${withResume.length}; ${candidates} are the base plus their stored changes and summary (skill order not stored, not compared), ${noResume} pass today but are not, or have no resume, and are not promoted; resume_hash names the stored resume on ${withResume.filter((p) => p.hashHolds).length} of ${withResume.length} (the rest are rewritten by --apply)`,
  );
  const retained = replayed.flatMap((p) => p.row.findings.filter((f) => f.bullet === "summary"));
  console.log(`summary findings kept from the original run, not replayable: ${retained.length} on ${replayed.filter((p) => p.row.findings.some((f) => f.bullet === "summary")).length} packets, by level ${JSON.stringify(count(retained.map((f) => f.level)))}`);

  console.log("\nstatus stored today against what the replay stamps, packets");
  const grid: Record<string, Record<string, number>> = {};
  for (const p of perPacket) {
    grid[p.status] ??= {};
    grid[p.status][p.outcome] = (grid[p.status][p.outcome] ?? 0) + 1;
  }
  console.table(grid);
  const stamped = (s: string) => replayed.filter((p) => p.decision !== "excluded" && p.decision.kind === "restamp" && p.decision.status === s).length;
  const withCandidate = replayed.filter((p) => p.decision !== "excluded" && p.decision.kind === "restamp");
  console.log(
    `stamped: ${stamped("ready")} ready, ${stamped("needs_review")} held for review, ${stamped("invalid")} invalid, of ${withCandidate.length} with a candidate; held is ${withCandidate.length ? ((100 * stamped("needs_review")) / withCandidate.length).toFixed(1) : "0"} percent of them`,
  );
  const readyToday = replayed.filter((p) => p.status === "ready");
  const heldOfReady = readyToday.filter((p) => p.outcome === "needs_review").length;
  const invalidOfReady = readyToday.filter((p) => p.outcome === "invalid").length;
  console.log(
    `of ${readyToday.length} packets ready today: ${heldOfReady} would be held for review (${readyToday.length ? ((100 * heldOfReady) / readyToday.length).toFixed(1) : "0"} percent), ${invalidOfReady} would be invalid (${readyToday.length ? ((100 * invalidOfReady) / readyToday.length).toFixed(1) : "0"} percent)`,
  );

  const by = (p: (typeof perPacket)[number], l: Level) => p.findings.filter((f) => f.level === l);
  const hard = replayed.flatMap((p) => by(p, "hard"));
  const review = replayed.flatMap((p) => by(p, "review"));
  const soft = replayed.flatMap((p) => by(p, "soft"));

  console.log("\nhard findings by reason, edits");
  console.table(count(hard.map((f) => f.message.replace(/: .*$/, ""))));
  console.log("hard findings, the contradictions named");
  console.table(count(hard.filter((f) => f.message.startsWith("value does not mean")).map((f) => f.message.replace(/^.*?: /, ""))));

  console.log("\nreview findings by reason, edits");
  const reviewKind = (f: PacketFinding) =>
    f.message.startsWith("name")
      ? f.detail === "sentence initial"
        ? "name, sentence initial"
        : "name"
      : f.message.startsWith("the fact and the line")
        ? "metric words differ"
        : f.message.startsWith("a number phrase")
          ? "number phrase unreadable, line"
          : f.message.startsWith("value could not be checked")
            ? "number phrase unreadable, cited fact"
            : "metric unreadable";
  console.table(count(review.map(reviewKind)));
  console.log("packets held for review by the reasons that hold them");
  console.table(count(replayed.filter((p) => p.outcome === "needs_review").map((p) => [...new Set(by(p, "review").map(reviewKind))].sort().join(" + "))));

  console.log("\nsoft findings by reason, edits");
  console.table(count(soft.map((f) => f.message)));

  const sample = (label: string, pick: (f: PacketFinding) => boolean, n = 12) => {
    const xs = review.filter(pick).map((f) => `${f.value ?? ""}  |  ${f.detail ?? ""}`);
    console.log(`\n${label}: ${xs.length} in all, first ${Math.min(n, xs.length)}`);
    for (const x of [...new Set(xs)].slice(0, n)) console.log("  " + x);
  };
  sample("metric words differ, fact against line", (f) => f.message.startsWith("the fact and the line"));
  sample("metric unreadable, fact against line", (f) => f.message.includes("could not be read"));
  console.log("\nsentence initial names in no fact, by word, edits");
  console.table(count(review.filter((f) => f.detail === "sentence initial").map((f) => String(f.value))));
  console.log("other names in no fact, by name, edits");
  console.table(count(review.filter((f) => f.message.startsWith("name") && f.detail !== "sentence initial").map((f) => String(f.value))));
  const hardSample = hard.map((f) => `${f.bullet}  ${f.message}${f.value ? ` (${f.value})` : ""}  ${f.detail ?? ""}`);
  console.log(`\nhard, first ${Math.min(12, hardSample.length)} of ${hardSample.length}`);
  for (const x of [...new Set(hardSample)].slice(0, 12)) console.log("  " + x);
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
