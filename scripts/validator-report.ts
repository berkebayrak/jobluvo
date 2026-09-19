import { readFileSync } from "node:fs";
import { and, eq, inArray, sql } from "drizzle-orm";
import { dbPool } from "@/db/client";
import { parseFlags } from "@/lib/cli";
import { jobs, packets, profileFacts, type PacketFinding, type ResumeDocument } from "@/db/schema";
import { buildResumeFacts, type FactRow, type ResumeFacts } from "@/server/match/profile";
import { lemmasOf } from "@/server/packet/entities";
import { codeOf, describeFindingsRead, labelOf, readFindings } from "@/server/packet/codes";
import { applyReplay, postingMoved, profileNotReproducible, replayDecision, sameDocument, SUMMARY_NOT_REVALIDATED, unreplayable, type RepairSource, type ReplayDecision, type ReplayRow } from "@/server/packet/replay";
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
 *                                       restamped: status and findings, with
 *                                       the document kept whatever the
 *                                       status says (D-038)
 *   --repair-from <snapshot dir>        offer a document to each row that has
 *                                       none and stores no change set to
 *                                       rebuild one from. Accepted only where
 *                                       the row's own stored changes reproduce
 *                                       the offered document, then validated
 *                                       under the rules as they stand like any
 *                                       other row (D-043)
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

/** Every packet row in a frozen snapshot that carries a document, by id. */
function repairSource(dir: string): Map<string, { document: ResumeDocument; hash: string; source: string }> {
  const file = `${dir.replace(/[\\/]+$/, "")}/packets.json`;
  const rows = JSON.parse(readFileSync(file, "utf8")) as { id: string; resume: ResumeDocument | null; resume_hash?: string | null; resumeHash?: string | null }[];
  const out = new Map<string, { document: ResumeDocument; hash: string; source: string }>();
  for (const r of rows) {
    if (!r.resume) continue;
    out.set(r.id, { document: r.resume, hash: r.resume_hash ?? r.resumeHash ?? "", source: file });
  }
  return out;
}

/** The column a packet lands in: the status it would be stamped with, or why it is not stamped. */
function outcomeOf(d: ReplayDecision): string {
  if (d.kind === "restamp") return d.coverage === "full" ? d.status : `${d.status}, bullets only`;
  if (d.kind === "hold") return `held, nothing could revalidate it: ${d.why.replace(/:.*$/, "")}`;
  if (d.kind === "no_candidate") return "not replayed, failed, no candidate";
  if (d.kind === "revoke") return `revoked, would pass as ${d.would} but the stored resume is not the base plus the stored changes`;
  if (d.kind === "rebuild") return `${d.status}, resume rebuilt from the stored change set`;
  if (d.kind === "repair") return `${d.status}, resume restored from ${d.source} and reproduced by the stored changes`;
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
      changeSet: packets.changeSet,
      attempt: packets.attempt,
      validatorRev: packets.validatorRev,
      factsHash: packets.factsHash,
      error: packets.error,
      updatedAt: sql<string>`${packets.updatedAt}::text`,
      contentHash: packets.contentHash,
      title: jobs.title,
      posting: jobs.descriptionCore,
      jobContentHash: jobs.contentHash,
    })
    .from(packets)
    .innerJoin(jobs, eq(jobs.id, packets.jobId));
  const byUser = new Map<string, typeof rows>();
  for (const p of rows) byUser.set(p.userId, [...(byUser.get(p.userId) ?? []), p]);

  const flags = parseFlags(process.argv.slice(2), { booleans: ["apply"] as const, values: ["repair-from"] as const });
  console.log("flags:", JSON.stringify({ ...flags.booleans, ...flags.values }));
  const apply = flags.booleans.apply;
  const repairs = flags.values["repair-from"] ? repairSource(flags.values["repair-from"]) : null;
  if (repairs) console.log(`repair source: ${repairs.size} packet rows carry a document`);
  // The boundary check, before any row is interpreted. `findings` is jsonb and its TypeScript type is an
  // assertion about the column rather than a guarantee from it, so a code this build does not declare can arrive
  // on a row written by a later build, a hand edit or a restored snapshot. It is counted and named here rather
  // than reaching a table as "undefined" (D-066).
  const boundary = describeFindingsRead(readFindings(rows.flatMap((p) => p.findings)));
  if (boundary) console.log(`\nstored findings this build could not recognise: ${boundary}`);
  const perPacket: { row: ReplayRow; run: string; status: string; edits: number; decision: ReplayDecision; findings: PacketFinding[]; outcome: string; hashHolds: boolean | null; rebuilds: boolean | null; excluded: boolean; postingMoved: boolean }[] = [];
  const profilesUsed: Record<string, number> = {};
  for (const [userId, ps] of byUser) {
    const candidates = await candidateProfiles(db, userId);
    for (const p of ps) {
      const row: ReplayRow = { id: p.id, status: p.status, resume: p.resume, resumeHash: p.resumeHash, findings: p.findings, changeSet: p.changeSet, updatedAt: p.updatedAt };
      const match = candidates.find((c) => c.facts.factsHash === p.factsHash);
      if (!match) {
        // Nothing to validate against. The row is held rather than skipped: leaving it was how a ready packet nothing
        // could check stayed ready and stayed consumable (review five, finding 6).
        const decision = unreplayable(row, profileNotReproducible());
        const findings = decision.kind === "hold" ? decision.findings : p.findings;
        perPacket.push({ row, run: p.run ?? "product", status: p.status, edits: p.changes.length, decision, findings, outcome: outcomeOf(decision), hashHolds: null, rebuilds: null, excluded: true, postingMoved: false });
        continue;
      }
      // The posting the validator is about to read against the revision the packet was written with. A job whose text has
      // moved cannot be read again the way the run read it, so the row is held rather than stamped from a different question.
      const moved = !!p.jobContentHash && !!p.contentHash && p.jobContentHash !== p.contentHash;
      profilesUsed[match.name] = (profilesUsed[match.name] ?? 0) + 1;
      const entries = factEntries(match.facts);
      const set = factSet(entries);
      const base = baseResume(match.facts);
      // A row with its change set is replayed whole, summary and skill order included; a legacy row has its bullets replayed and its
      // summary carried as the stored resume has it, and the decision names that coverage (review four, finding 2).
      const posting = lemmasOf(`${p.title}\n${p.posting ?? ""}`);
      const replayed = p.changeSet ? validateChangeSet(p.changeSet, base, set, posting) : validateChangeSet({ summary: null, summaryFacts: [], changes: p.changes, skills: [] }, base, set, posting);
      // A row with no document of its own may be offered one: the candidate is then built from the row's own stored
      // changes and that document's summary, which is the test the offered document has to pass in replayDecision.
      const offered = !p.resume && !p.changeSet ? (repairs?.get(p.id) ?? null) : null;
      const summaryOf = p.resume?.summary ?? offered?.document.summary ?? null;
      const candidate = p.changeSet
        ? applyChanges(base, p.changeSet).resume
        : p.resume || offered
          ? applyChanges(base, { summary: summaryOf, summaryFacts: [], changes: p.changes, skills: [] }).resume
          : null;
      const repair: RepairSource | undefined = offered ? { document: offered.document, source: offered.source, hash: offered.hash } : undefined;
      const decision = replayDecision(row, replayed, candidate, moved ? [postingMoved()] : [], repair);
      const findings = decision.kind === "no_candidate" ? p.findings : decision.findings;
      const hashHolds = p.resume ? resumeHash(p.resume) === p.resumeHash : null;
      const rebuilds = p.resume && candidate ? sameDocument(p.resume, candidate) : null;
      perPacket.push({ row, run: p.run ?? "product", status: p.status, edits: p.changes.length, decision, findings, outcome: outcomeOf(decision), hashHolds, rebuilds, excluded: false, postingMoved: moved });
    }
  }
  const replayed = perPacket.filter((p) => !p.excluded);
  const has = (p: (typeof perPacket)[number]) => p.decision.kind === "restamp" || p.decision.kind === "revoke" || p.decision.kind === "no_resume";
  const full = replayed.filter((p) => has(p) && "coverage" in p.decision && p.decision.coverage === "full").length;
  const bulletsOnly = replayed.filter((p) => has(p) && "coverage" in p.decision && p.decision.coverage === "bullets").length;
  console.log(`coverage: ${full} packets replayed whole from their stored change set, ${bulletsOnly} bullets only (stored before change sets were kept; a summary on such a row is held, not stamped ready)`);
  const excluded = perPacket.filter((p) => p.excluded);
  const moved = perPacket.filter((p) => p.postingMoved);
  console.log(
    `inputs the replay could not read the way the run did: ${excluded.length} packets whose facts hash no profile on hand reproduces, ${moved.length} whose job text has moved since. Every one of them that is ready or held today is held by --apply and its resume kept, never left consumable on evidence nothing can check (review five, finding 6)`,
  );

  if (apply) {
    // Every row, the excluded ones included: an excluded row that is ready today is exactly the one that must not be skipped.
    const result = await applyReplay(
      db,
      perPacket.map((p) => ({ row: p.row, decision: p.decision })),
    );
    console.log(
      `\napplied: ${result.restamped} packets written under the rules as they stand, ${result.changedStatus} changed status, ${result.revoked} of them revoked because their stored resume could not be verified, ${result.held} held because nothing could revalidate them, ${result.rebuilt} rebuilt from their own stored change set after a rejection cleared the resume (D-037), ${result.repaired} repaired from a document offered outside the row and reproduced by the row's own stored changes (D-043), ${result.untouched} left as they are (failed, or with no document and nothing offered that the row reproduces), ${result.stale} refused because the row moved since it was read`,
    );
  }

  const edits = replayed.reduce((a, p) => a + p.edits, 0);
  console.log(`packets on hand ${rows.length}, replayed ${replayed.length} (${edits} bullet edits), ${excluded.length} whose facts hash no profile on hand reproduces and are held instead`);
  console.log("profiles the packets were built on:", JSON.stringify(profilesUsed));
  const withResume = perPacket.filter((p) => p.hashHolds !== null);
  const rebuilds = perPacket.filter((p) => p.rebuilds).length;
  const noResume = replayed.filter((p) => p.decision.kind === "no_resume").length;
  const revoked = replayed.filter((p) => p.decision.kind === "revoke").length;
  console.log(
    `stored resumes: ${withResume.length}; ${rebuilds} are the base plus their stored changes and summary (skill order not stored, not compared); ${noResume} pass today but have no such resume and are not promoted; ${revoked} ready or held rows have a resume that cannot be verified and are revoked to invalid by --apply; resume_hash names the stored resume on ${withResume.filter((p) => p.hashHolds).length} of ${withResume.length} (the rest are rewritten by --apply)`,
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
  const stamped = (s: string) => replayed.filter((p) => p.decision.kind === "restamp" && p.decision.status === s).length;
  const withCandidate = replayed.filter((p) => p.decision.kind === "restamp");
  console.log(
    `stamped: ${stamped("ready")} ready, ${stamped("needs_review")} held for review, ${stamped("invalid")} invalid, of ${withCandidate.length} with a candidate; held is ${withCandidate.length ? ((100 * stamped("needs_review")) / withCandidate.length).toFixed(1) : "0"} percent of them`,
  );
  // Counted from the decision's status, never from the outcome label, which also names the coverage.
  const stampedStatus = (p: (typeof perPacket)[number]) => (p.decision.kind === "restamp" || p.decision.kind === "revoke" || p.decision.kind === "hold" ? p.decision.status : null);
  const readyToday = perPacket.filter((p) => p.status === "ready");
  const heldOfReady = readyToday.filter((p) => stampedStatus(p) === "needs_review").length;
  const invalidOfReady = readyToday.filter((p) => stampedStatus(p) === "invalid").length;
  const heldByCoverage = readyToday.filter((p) => stampedStatus(p) === "needs_review" && p.findings.some((f) => f.message === SUMMARY_NOT_REVALIDATED)).length;
  console.log(
    `of ${readyToday.length} packets ready today: ${heldOfReady} would be held for review (${readyToday.length ? ((100 * heldOfReady) / readyToday.length).toFixed(1) : "0"} percent), ${invalidOfReady} would be invalid (${readyToday.length ? ((100 * invalidOfReady) / readyToday.length).toFixed(1) : "0"} percent)`,
  );
  console.log(`of those held, ${heldByCoverage} only because their summary could not be revalidated (no stored change set)`);

  const by = (p: (typeof perPacket)[number], l: Level) => p.findings.filter((f) => f.level === l);
  const hard = replayed.flatMap((p) => by(p, "hard"));
  const review = replayed.flatMap((p) => by(p, "review"));
  const soft = replayed.flatMap((p) => by(p, "soft"));

  console.log("\nhard findings by reason, edits");
  console.table(count(hard.map(labelOf)));
  console.log("hard findings, the contradictions named");
  console.table(count(hard.filter((f) => f.message.startsWith("value does not mean")).map((f) => f.message.replace(/^.*?: /, ""))));

  console.log("\nreview findings by reason, edits");
  // Named by stable code, never by message (finding 17), from the one label map in src/server/packet/codes.ts.
  // It used to be a partial map here with a fallback branch, so a code with no entry printed "unclassified" and
  // the table kept its shape and its length: four codes had drifted into that state, one of them `posting-moved`,
  // which is a live reason a row is held today. The map is exhaustive by type now, so an unlabelled code fails
  // the typecheck rather than printing a word (D-061). A finding carrying no code this build knows still says so,
  // which is a different thing and stays.
  const reviewKind = (f: PacketFinding) => (codeOf(f) === "name-unknown" ? `name, ${f.detail ?? ""}` : labelOf(f));
  console.table(count(review.map(reviewKind)));
  console.log("packets held for review by the reasons that hold them");
  console.table(count(replayed.filter((p) => stampedStatus(p) === "needs_review").map((p) => [...new Set(by(p, "review").map(reviewKind))].sort().join(" + "))));

  console.log("\nsoft findings by reason, edits");
  // By code like the other two. Counting these by message is the coupling codes.ts exists to remove, and it is
  // why `resume-repaired` had never appeared in this report under a name of its own (D-061).
  console.table(count(soft.map(labelOf)));

  const sample = (label: string, pick: (f: PacketFinding) => boolean, n = 12) => {
    const xs = review.filter(pick).map((f) => `${f.value ?? ""}  |  ${f.detail ?? ""}`);
    console.log(`\n${label}: ${xs.length} in all, first ${Math.min(n, xs.length)}`);
    for (const x of [...new Set(xs)].slice(0, n)) console.log("  " + x);
  };
  sample("metric words differ, fact against line", (f) => f.message.startsWith("the fact and the line"));
  sample("metric unreadable, fact against line", (f) => f.message.includes("could not be read"));
  console.log("\nnames in no fact, by name and reason, edits");
  console.table(count(review.filter((f) => f.message.startsWith("name")).map((f) => `${f.value} (${f.detail ?? ""})`)));
  console.log("words from the posting in no fact, by word, edits");
  console.table(count(review.filter((f) => f.message.startsWith("word from the posting")).map((f) => String(f.value))));
  console.log("responsibilities not in the cited facts, by object and hint, edits");
  console.table(count(review.filter((f) => f.message.startsWith("responsibility")).map((f) => `${f.value}, ${f.detail ?? ""}`)));
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
