import { createHash } from "node:crypto";
import { execSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { inArray, sql } from "drizzle-orm";
import { dbPool } from "@/db/client";
import { costEvents, jobs, matches, packets, profileDocuments, profileFacts, sources, users } from "@/db/schema";
import { buildResumeFacts, type FactRow } from "@/server/match/profile";
import { baseResume, factEntries, resumeHash, shapedResume } from "@/server/packet/resume";
import { parseFlags } from "@/lib/cli";

/*
 * Freezes the packet population and everything needed to reproduce it to
 * files outside the database, so the next run cannot overwrite what is
 * measured. Read only: nothing is written to the database.
 *
 *   npm run snapshot-packets -- --out design/snapshots/2026-09-18-packets
 *
 * Writes one JSON file per table plus profiles.json (the fact sets the
 * packets were built on, rebuilt from their rows and checked by hash) and
 * meta.json (counts, revision, what is absent). Then reads every file back
 * and checks it against the counts read from the database.
 */

const FLAGS = { booleans: [], values: ["out"] } as const;

const sha256 = (s: string) => createHash("sha256").update(s).digest("hex");
const json = (v: unknown) => JSON.stringify(v, null, 1);

async function main() {
  const { values } = parseFlags(process.argv.slice(2), FLAGS);
  const out = values.out ?? `design/snapshots/${new Date().toISOString().slice(0, 10)}-packets`;
  mkdirSync(out, { recursive: true });
  const db = dbPool();
  const takenAt = new Date().toISOString();
  const revision = execSync("git rev-parse HEAD").toString().trim();
  const status = execSync("git status --short").toString().trim();
  const absent: string[] = [];

  const packetRows = await db.select().from(packets).orderBy(packets.createdAt, packets.id);
  const costRows = await db.select().from(costEvents).orderBy(costEvents.createdAt, costEvents.id);
  const userRows = await db.select().from(users);
  const factRows = await db.select().from(profileFacts).orderBy(profileFacts.createdAt, profileFacts.id);
  const docRows = await db
    .select({
      id: profileDocuments.id,
      userId: profileDocuments.userId,
      filename: profileDocuments.filename,
      text: profileDocuments.text,
      pageCount: profileDocuments.pageCount,
      status: profileDocuments.status,
      error: profileDocuments.error,
      uploadedAt: profileDocuments.uploadedAt,
      bytesLength: sql<number>`length(bytes_phase0)`.mapWith(Number),
      bytesSha256: sql<string>`encode(sha256(bytes_phase0), 'hex')`,
    })
    .from(profileDocuments);
  absent.push("profile_documents.bytes_phase0, the PDF itself, is not exported; its length and sha256 are");

  const jobIds = new Set<string>(packetRows.map((p) => p.jobId));
  for (const c of costRows) if ((c.kind === "tailor" || c.kind === "score") && c.refId) jobIds.add(c.refId);
  const jobRows = jobIds.size ? await db.select().from(jobs).where(inArray(jobs.id, [...jobIds])).orderBy(jobs.id) : [];
  const foundJobs = new Set(jobRows.map((j) => j.id));
  const missingJobs = [...jobIds].filter((id) => !foundJobs.has(id));
  if (missingJobs.length) {
    const missing = new Set(missingJobs);
    const byRun = new Map<string, number>();
    for (const c of costRows) if (c.refId && missing.has(c.refId)) byRun.set(`${c.run ?? "(cron)"} ${c.kind}`, (byRun.get(`${c.run ?? "(cron)"} ${c.kind}`) ?? 0) + 1);
    const onPackets = packetRows.filter((p) => missing.has(p.jobId)).length;
    absent.push(`${missingJobs.length} job ids referenced by cost rows have no jobs row (${onPackets} of them on a packet); cost rows by run: ${[...byRun].map(([k, n]) => `${k} ${n}`).join(", ")}`);
  }
  const changedJobs = packetRows.filter((p) => { const j = jobRows.find((j) => j.id === p.jobId); return j && j.contentHash !== p.contentHash; }).map((p) => p.id);
  if (changedJobs.length) absent.push(`${changedJobs.length} packets carry a content_hash their job no longer has, so the posting text the model saw is not the stored one: packet ids ${changedJobs.join(", ")}`);
  const sourceIds = [...new Set(jobRows.map((j) => j.sourceId))];
  const sourceRows = sourceIds.length ? await db.select().from(sources).where(inArray(sources.id, sourceIds)) : [];
  const matchRows = jobIds.size ? await db.select().from(matches).where(inArray(matches.jobId, [...jobIds])) : [];

  // The fact sets the packets were built on. Each distinct facts_hash on a
  // packet is checked against the row sets that could have produced it. A
  // hash no row set reproduces is reported as absent, not reconstructed.
  const factsHashes = [...new Set(packetRows.map((p) => p.factsHash))];
  const toFactRow = (r: (typeof factRows)[number]): FactRow => ({ id: r.id, kind: r.kind, data: r.data, origin: r.origin, evidence: r.evidence });
  const profiles: Record<string, unknown> = {};
  for (const u of userRows) {
    const mine = factRows.filter((r) => r.userId === u.id);
    const preference = mine.filter((r) => r.kind === "preference" && r.status === "confirmed");
    const candidates: { name: string; rows: (typeof factRows)[number][] }[] = [
      { name: "confirmed now", rows: mine.filter((r) => r.status === "confirmed") },
      { name: "confirmed preference plus rejected rows with no document, the seeded facts", rows: [...preference, ...mine.filter((r) => r.status === "rejected" && r.documentId === null)] },
    ];
    for (const d of docRows.filter((d) => d.userId === u.id)) {
      candidates.push({ name: `confirmed preference plus every row of document ${d.id} in any status`, rows: [...preference, ...mine.filter((r) => r.documentId === d.id)] });
    }
    for (const c of candidates) {
      const facts = buildResumeFacts(u.id, c.rows.map(toFactRow));
      if (!facts) continue;
      const base = baseResume(facts);
      const entry = {
        userId: u.id,
        rowSet: c.name,
        rowIds: c.rows.map((r) => r.id),
        factsHash: facts.factsHash,
        prefsHash: facts.prefsHash,
        matchesPacketHash: factsHashes.includes(facts.factsHash),
        packetsOnThisHash: packetRows.filter((p) => p.factsHash === facts.factsHash).length,
        facts,
        factEntries: factEntries(facts),
        baseResume: base,
        baseResumeHash: resumeHash(base),
        baseResumeShapeHash: resumeHash(shapedResume(base)),
      };
      const key = facts.factsHash;
      if (!(key in profiles)) profiles[key] = entry;
    }
  }
  for (const h of factsHashes) if (!(h in profiles)) absent.push(`facts_hash ${h} on ${packetRows.filter((p) => p.factsHash === h).length} packets is reproduced by no row set`);

  const files: Record<string, unknown> = {
    "packets.json": packetRows,
    "cost_events.json": costRows,
    "users.json": userRows,
    "profile_facts.json": factRows,
    "profile_documents.json": docRows,
    "jobs.json": jobRows,
    "sources.json": sourceRows,
    "matches.json": matchRows,
    "profiles.json": profiles,
  };
  for (const [name, rows] of Object.entries(files)) writeFileSync(join(out, name), json(rows));

  // Counts read from the database by their own queries, independent of the exports above.
  const count = async (table: string, where = "") => Number((await db.execute(sql.raw(`select count(*)::int as n from ${table} ${where}`))).rows[0]!.n);
  const dbCounts = {
    packets: await count("packets"),
    cost_events: await count("cost_events"),
    users: await count("users"),
    profile_facts: await count("profile_facts"),
    profile_documents: await count("profile_documents"),
    jobs_referenced: jobIds.size,
    packets_by_run_status: (await db.execute(sql`select coalesce(run, '(null)') as run, status, count(*)::int as n from packets group by 1, 2 order by 1, 2`)).rows,
    cost_by_run: (await db.execute(sql`select run, kind, count(*)::int as calls, count(distinct ref_id)::int as refs, round(sum(usd)::numeric, 6) as usd from cost_events where run is not null group by 1, 2 order by min(created_at)`)).rows,
  };

  // Verification: every file reads back as JSON with the row count the database reports.
  const manifest: Record<string, { bytes: number; sha256: string; rows: number | null }> = {};
  const problems: string[] = [];
  const expect: Record<string, number> = { "packets.json": dbCounts.packets, "cost_events.json": dbCounts.cost_events, "users.json": dbCounts.users, "profile_facts.json": dbCounts.profile_facts, "profile_documents.json": dbCounts.profile_documents, "jobs.json": jobRows.length, "sources.json": sourceRows.length, "matches.json": matchRows.length };
  for (const name of [...Object.keys(files), "families-18sep-saved-answers.json"]) {
    let text: string;
    try {
      text = readFileSync(join(out, name), "utf8");
    } catch {
      problems.push(`${name} is missing`);
      continue;
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch {
      problems.push(`${name} is not JSON`);
      continue;
    }
    const rows = Array.isArray(parsed) ? parsed.length : null;
    manifest[name] = { bytes: Buffer.byteLength(text), sha256: sha256(text), rows };
    if (name in expect && rows !== expect[name]) problems.push(`${name} has ${rows} rows, the database reports ${expect[name]}`);
  }
  const saved = manifest["families-18sep-saved-answers.json"];
  if (!saved) problems.push("the saved answers of the 80 job sample are not in the snapshot");
  else if (saved.rows !== 80) problems.push(`the saved answers hold ${saved.rows} outcomes, not 80`);

  const meta = {
    takenAt,
    revision,
    workingTreeClean: status === "",
    database: process.env.DATABASE_URL?.replace(/\/\/[^@]*@/, "//***@") ?? null,
    dbCounts,
    manifest,
    absent,
    problems,
  };
  writeFileSync(join(out, "meta.json"), json(meta));
  console.log(json({ out, revision, dbCounts: { packets: dbCounts.packets, cost_events: dbCounts.cost_events, profile_facts: dbCounts.profile_facts, jobs: jobRows.length }, profiles: Object.values(profiles).map((p) => { const e = p as { rowSet: string; factsHash: string; matchesPacketHash: boolean; packetsOnThisHash: number }; return { rowSet: e.rowSet, factsHash: e.factsHash.slice(0, 12), matchesPacketHash: e.matchesPacketHash, packets: e.packetsOnThisHash }; }), absent, problems }));
  if (problems.length) process.exit(1);
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
