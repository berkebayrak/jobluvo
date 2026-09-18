import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { Packet, PacketFinding } from "@/db/schema";
import { parseFlags } from "@/lib/cli";
import type { ResumeFacts } from "@/server/match/profile";
import { applyChanges, baseResume, factEntries, resumeHash, shapedResume, type ChangeSet } from "@/server/packet/resume";
import { classifyRetry, mergeRetry } from "@/server/packet/retry";
import { factSet, isHard, needsReview, validateChangeSet } from "@/server/packet/validate";

/*
 * Reconciles a stored sample against its saved answers, packet by packet,
 * from a snapshot directory and nothing else: no database, no call.
 *
 *   npm run reconcile-sample -- --dir design/snapshots/2026-09-18-packets --run families-18sep-changes --answers families-18sep-saved-answers.json
 *
 * For every packet: the status stored (the baseline, read before any rule is
 * applied), each attempt re-read under the rules as they stand, the attempt
 * the run retained by its own rule, and the last attempt, which is what the
 * scope table in tailor-sample read. Then: whether the stored document
 * differs from the base at all (summary and skill order included), what a
 * retry did to the first answer, and whether every cost row ties to an
 * attempt. Writes reconciliation.md into the directory and prints it.
 */

type Status = "ready" | "needs_review" | "invalid";
type SavedOutcome = { jobId: string; status: string; attempts: number; usd: number; attemptLog: (string | { outcome: string })[]; changeSets: (ChangeSet | null)[]; posting: string[] };
const outcomeOf = (a: string | { outcome: string }) => (typeof a === "string" ? a : a.outcome);
type Profile = { factsHash: string; facts: ResumeFacts; baseResumeShapeHash: string };
type CostRow = { refId: string | null; run: string | null; usd: number; createdAt: string; tokensIn: number; tokensOut: number };

const statusOf = (f: PacketFinding[]): Status => (isHard(f) ? "invalid" : needsReview(f) ? "needs_review" : "ready");

/** The attempt the run keeps (src/server/packet/run.ts): the last, unless a held answer's retry came back rejected or failed. */
function retainedIndex(outcomes: string[]): number {
  const last = outcomes.length - 1;
  const before = outcomes[last - 1];
  return before === "needs_review" && (outcomes[last] === "invalid" || outcomes[last] === "failed") ? last - 1 : last;
}

function main() {
  const { values, booleans } = parseFlags(process.argv.slice(2), { booleans: ["examples"], values: ["dir", "run", "answers"] } as const);
  const examples = booleans.examples;
  const dir = values.dir ?? "design/snapshots/2026-09-18-packets";
  const run = values.run ?? "families-18sep-changes";
  const read = <T>(name: string): T => JSON.parse(readFileSync(join(dir, name), "utf8")) as T;
  const packets = (read<Packet[]>("packets.json")).filter((p) => p.run === run);
  const saved = read<SavedOutcome[]>(values.answers ?? "families-18sep-saved-answers.json");
  const profiles = read<Record<string, Profile>>("profiles.json");
  const costs = (read<CostRow[]>("cost_events.json")).filter((c) => c.run === run);

  const hashes = [...new Set(packets.map((p) => p.factsHash))];
  if (hashes.length !== 1) throw new Error(`the run's packets sit on ${hashes.length} profiles: ${hashes.join(", ")}`);
  const profile = profiles[hashes[0]!];
  if (!profile) throw new Error(`profiles.json has no profile for facts hash ${hashes[0]}`);
  const facts = profile.facts;
  const base = baseResume(facts);
  const set = factSet(factEntries(facts));
  const baseShape = resumeHash(shapedResume(base));
  if (baseShape !== profile.baseResumeShapeHash) throw new Error("the base resume rebuilt here does not match the snapshot's shape hash");
  const posting = (o: SavedOutcome) => new Set(o.posting);

  const lines: string[] = [];
  const out = (s = "") => lines.push(s);
  out(`# Reconciliation of ${run}, read from ${dir}`);
  out();
  out(`Packets ${packets.length}, saved answers ${saved.length}, cost rows ${costs.length}. Profile ${hashes[0]!.slice(0, 12)}, ${factEntries(facts).length} facts. Rules as they stand at the code revision this ran on; the baseline is the stored status and findings, read before any rule was applied.`);
  out();

  const byJob = new Map(saved.map((o) => [o.jobId, o]));
  type Row = {
    id: string;
    stored: Status;
    storedAttempts: number;
    outcomes: string[];
    retained: number;
    reread: (Status | null)[];
    retainedReread: Status | null;
    lastReread: Status | null;
    category: string;
    wholeDocumentChanged: boolean | null;
    bulletEdits: number;
    retry: string | null;
  };
  const rows: Row[] = [];
  const count = (xs: (Status | null)[]) => ({ ready: xs.filter((x) => x === "ready").length, held: xs.filter((x) => x === "needs_review").length, invalid: xs.filter((x) => x === "invalid").length, none: xs.filter((x) => x === null).length });

  for (const p of packets) {
    const o = byJob.get(p.jobId);
    if (!o) {
      rows.push({ id: p.id, stored: p.status as Status, storedAttempts: p.attempts, outcomes: [], retained: -1, reread: [], retainedReread: null, lastReread: null, category: "no saved answer", wholeDocumentChanged: null, bulletEdits: p.changes.length, retry: null });
      continue;
    }
    const reread = o.changeSets.map((cs) => (cs ? statusOf(validateChangeSet(cs, base, set, posting(o))) : null));
    const retained = retainedIndex(o.attemptLog.map(outcomeOf));
    const retainedReread = reread[retained] ?? null;
    const lastReread = reread[reread.length - 1] ?? null;
    let category: string;
    if (retainedReread === p.status && lastReread === p.status) category = "same on every reading";
    else if (retainedReread === p.status && lastReread !== p.status) category = "retained attempt differs from the last attempt (finding 13)";
    else if (retainedReread !== p.status) category = `retained attempt re-reads as ${retainedReread}, stored ${p.status}: a rule or input difference, not attempt selection`;
    else category = "unclassified";
    // Whole document: the stored resume against the base, summary and skill order included.
    const wholeDocumentChanged = p.resume ? resumeHash(shapedResume(p.resume)) !== baseShape : null;
    // What the retry did to the first answer.
    let retry: string | null = null;
    if (o.changeSets.length === 2 && o.changeSets[0] && o.changeSets[1]) {
      const a1 = applyChanges(base, o.changeSets[0]);
      const a2 = applyChanges(base, o.changeSets[1]);
      const e1 = new Set(a1.diff.map((d) => d.bullet));
      const e2 = new Set(a2.diff.map((d) => d.bullet));
      const skills1 = o.changeSets[0].skills.length > 0;
      const skills2 = o.changeSets[1].skills.length > 0;
      const same2 = resumeHash(shapedResume(a2.resume)) === baseShape;
      if (same2) retry = "reverted to the base resume";
      else if ([...e1].every((b) => e2.has(b)) && (!skills1 || skills2)) retry = e2.size > e1.size ? "kept every edited line and edited more" : "kept every edited line, substituted";
      else if ([...e2].every((b) => e1.has(b))) retry = `dropped ${[...e1].filter((b) => !e2.has(b)).length} of ${e1.size} edited lines${skills1 && !skills2 ? " and the skill order" : ""}`;
      else retry = "edited a different set of lines";
      retry += `; retained attempt ${retained + 1}`;
    }
    rows.push({ id: p.id, stored: p.status as Status, storedAttempts: p.attempts, outcomes: o.attemptLog.map(outcomeOf), retained, reread, retainedReread, lastReread, category, wholeDocumentChanged, bulletEdits: p.changes.length, retry });
  }

  out("## Statuses, three readings of the same 80 answers");
  out();
  out("| Reading | Ready | Held | Invalid | None |");
  out("|---|---|---|---|---|");
  const c1 = count(rows.map((r) => r.stored));
  const c2 = count(rows.map((r) => r.retainedReread));
  const c3 = count(rows.map((r) => r.lastReread));
  out(`| Stored status, the retained attempt as the run wrote it | ${c1.ready} | ${c1.held} | ${c1.invalid} | ${c1.none} |`);
  out(`| Retained attempt re-read under the rules as they stand | ${c2.ready} | ${c2.held} | ${c2.invalid} | ${c2.none} |`);
  out(`| Last attempt re-read, what the scope table in tailor-sample counted | ${c3.ready} | ${c3.held} | ${c3.invalid} | ${c3.none} |`);
  out();
  out("## Where the readings differ, by packet");
  out();
  const cats = new Map<string, Row[]>();
  for (const r of rows) cats.set(r.category, [...(cats.get(r.category) ?? []), r]);
  for (const [cat, rs] of [...cats].sort((a, b) => b[1].length - a[1].length)) out(`- ${rs.length}: ${cat}`);
  out();
  const differing = rows.filter((r) => r.category !== "same on every reading");
  if (differing.length) {
    out("| Packet | Stored | Attempts as run | Retained | Re-read per attempt | Category |");
    out("|---|---|---|---|---|---|");
    for (const r of differing) out(`| ${r.id.slice(0, 8)} | ${r.stored} | ${r.outcomes.join(" > ")} | ${r.retained + 1} | ${r.reread.join(" > ")} | ${r.category} |`);
    out();
  }

  // What the rules as they stand add to or remove from the retained attempt's stored findings: the delta a rule change owes before it ships.
  out("## Findings the rules as they stand add or remove on the retained attempts");
  out();
  const added = new Map<string, number>();
  const removed = new Map<string, number>();
  const addedPackets = new Map<string, Set<string>>();
  const sig = (f: PacketFinding) => `${f.level}: ${f.message}${f.detail && /says|fact:/.test(f.detail) ? "" : ""}`;
  for (const p of packets) {
    const o = byJob.get(p.jobId);
    if (!o) continue;
    const retained = retainedIndex(o.attemptLog.map(outcomeOf));
    const cs = o.changeSets[retained];
    if (!cs) continue;
    const now = validateChangeSet(cs, base, set, posting(o)).filter((f) => f.level !== "soft");
    const was = p.findings.filter((f) => f.level !== "soft");
    const key = (f: PacketFinding) => `${f.level}|${f.bullet}|${f.message}|${f.value ?? ""}`;
    const wasKeys = new Set(was.map(key));
    const nowKeys = new Set(now.map(key));
    for (const f of now) if (!wasKeys.has(key(f))) { added.set(sig(f), (added.get(sig(f)) ?? 0) + 1); addedPackets.set(sig(f), (addedPackets.get(sig(f)) ?? new Set()).add(p.id)); }
    for (const f of was) if (!nowKeys.has(key(f))) removed.set(sig(f), (removed.get(sig(f)) ?? 0) + 1);
  }
  out("| Added, by finding | Edits | Packets |");
  out("|---|---|---|");
  for (const [k, n] of [...added].sort((a, b) => b[1] - a[1])) out(`| ${k} | ${n} | ${addedPackets.get(k)?.size ?? 0} |`);
  out();
  out("| Removed, by finding | Edits |");
  out("|---|---|");
  for (const [k, n] of [...removed].sort((a, b) => b[1] - a[1])) out(`| ${k} | ${n} |`);
  out();
  if (examples) {
    out("Examples of added findings, first 40:");
    out();
    let shown = 0;
    for (const p of packets) {
      const o = byJob.get(p.jobId);
      if (!o) continue;
      const cs = o.changeSets[retainedIndex(o.attemptLog.map(outcomeOf))];
      if (!cs) continue;
      const now = validateChangeSet(cs, base, set, posting(o)).filter((f) => f.level !== "soft");
      const wasKeys = new Set(p.findings.map((f) => `${f.level}|${f.bullet}|${f.message}|${f.value ?? ""}`));
      for (const f of now) {
        if (wasKeys.has(`${f.level}|${f.bullet}|${f.message}|${f.value ?? ""}`) || shown >= 40) continue;
        const line = f.bullet === "summary" ? cs.summary : cs.changes.find((c) => c.bullet === f.bullet)?.text;
        out(`- ${p.id.slice(0, 8)} ${f.bullet} [${f.level}] ${f.message} (${f.value ?? ""}) ${f.detail ?? ""}`);
        out(`  line: ${line}`);
        shown += 1;
      }
    }
    out();
  }

  out("## Unchanged packets, the whole document against the base");
  out();
  const withResume = rows.filter((r) => r.wholeDocumentChanged !== null);
  const unchangedWhole = withResume.filter((r) => r.wholeDocumentChanged === false);
  const zeroBullets = rows.filter((r) => r.bulletEdits === 0);
  out(`Packets with a stored resume ${withResume.length}. Identical to the base resume, summary and skill order included: ${unchangedWhole.length}. Packets with zero bullet edits: ${zeroBullets.length}, of which ${zeroBullets.filter((r) => r.wholeDocumentChanged === false).length} are also identical as a whole document and ${zeroBullets.filter((r) => r.wholeDocumentChanged === true).length} changed the summary or skill order only.`);
  out();
  out("| Unchanged whole document | Ready | Held | Invalid |");
  out("|---|---|---|---|");
  const cu = count(unchangedWhole.map((r) => r.stored));
  out(`| ${unchangedWhole.length} | ${cu.ready} | ${cu.held} | ${cu.invalid} |`);
  out();

  out("## What a retry did to the first answer");
  out();
  const retried = rows.filter((r) => r.retry);
  const byRetry = new Map<string, number>();
  for (const r of retried) byRetry.set(r.retry!, (byRetry.get(r.retry!) ?? 0) + 1);
  out(`Retried packets with two parsed answers: ${retried.length}.`);
  out();
  out("| Retry outcome | Packets |");
  out("|---|---|");
  for (const [k, n] of [...byRetry].sort((a, b) => b[1] - a[1])) out(`| ${k} | ${n} |`);
  out();
  out("| Packet | Stored | Attempts as run | Bullet edits stored | Whole document changed | Retry |");
  out("|---|---|---|---|---|---|");
  for (const r of retried) out(`| ${r.id.slice(0, 8)} | ${r.stored} | ${r.outcomes.join(" > ")} | ${r.bulletEdits} | ${r.wholeDocumentChanged} | ${r.retry} |`);
  out();

  // Finding 14's rule, measured on these answers before it ships: the retry's clean dropped lines put back, the merged
  // set validated whole. Attempt 1's findings are recomputed under the rules as they stand, so this is the delta of the
  // merge alone. The prompt change that shows the retry its previous answer cannot be measured here; it needs a paid run.
  out("## What the merge rule of finding 14 changes on these answers");
  out();
  type Merge = { id: string; retainedIsRetry: boolean; kind: string; dropped: number; of: number; clean: number; before: Status | null; after: Status | null };
  const merges: Merge[] = [];
  for (const p of packets) {
    const o = byJob.get(p.jobId);
    if (!o) continue;
    const [cs1, cs2] = [o.changeSets[0], o.changeSets[1]];
    if (o.changeSets.length !== 2 || !cs1 || !cs2) continue;
    const f1 = validateChangeSet(cs1, base, set, posting(o));
    const c = classifyRetry(base, cs1, cs2, f1);
    const merged = mergeRetry(cs1, cs2, c);
    const retained = retainedIndex(o.attemptLog.map(outcomeOf));
    merges.push({
      id: p.id,
      retainedIsRetry: retained === 1,
      kind: c.kind,
      dropped: c.dropped.length,
      of: c.of,
      clean: c.clean.length,
      before: statusOf(validateChangeSet(cs2, base, set, posting(o))),
      after: statusOf(validateChangeSet(merged, base, set, posting(o))),
    });
  }
  const applies = merges.filter((m) => m.retainedIsRetry);
  const restoring = applies.filter((m) => m.clean > 0);
  out(`Retried packets with two parsed answers: ${merges.length}, of which ${applies.length} kept the retry as the packet and are what the rule touches. The other ${merges.length - applies.length} kept the first answer because the retry came back rejected or failed, and the merge does not apply to them.`);
  out();
  out("| What the retry did | Packets | Lines dropped | Of those, clean |");
  out("|---|---|---|---|");
  const byKind = new Map<string, Merge[]>();
  for (const m of applies) byKind.set(m.kind, [...(byKind.get(m.kind) ?? []), m]);
  for (const [k, ms] of [...byKind].sort((a, b) => b[1].length - a[1].length)) {
    out(`| ${k} | ${ms.length} | ${ms.reduce((a, m) => a + m.dropped, 0)} | ${ms.reduce((a, m) => a + m.clean, 0)} |`);
  }
  out();
  out(`Lines put back in all: ${applies.reduce((a, m) => a + m.clean, 0)} across ${restoring.length} packets. A dropped line the validator had objected to is never put back; the difference between the two columns above is those.`);
  out();
  out("| Status of the retained answer | Ready | Held | Invalid |");
  out("|---|---|---|---|");
  const cb = count(applies.map((m) => m.before));
  const ca = count(applies.map((m) => m.after));
  out(`| The retry as it came back, today's rule | ${cb.ready} | ${cb.held} | ${cb.invalid} |`);
  out(`| The retry with its clean dropped lines put back | ${ca.ready} | ${ca.held} | ${ca.invalid} |`);
  out();
  const moved = applies.filter((m) => m.before !== m.after);
  out(`Packets whose status moves: ${moved.length}.`);
  if (moved.length) {
    out();
    out("| Packet | Lines put back | Was | Becomes |");
    out("|---|---|---|---|");
    for (const m of moved) out(`| ${m.id.slice(0, 8)} | ${m.clean} | ${m.before} | ${m.after} |`);
  }
  out();

  out("## Spend, every cost row tied to an attempt");
  out();
  const costByJob = new Map<string, CostRow[]>();
  for (const c of costs) if (c.refId) costByJob.set(c.refId, [...(costByJob.get(c.refId) ?? []), c]);
  const problems: string[] = [];
  let tied = 0;
  for (const p of packets) {
    const o = byJob.get(p.jobId);
    const cs = (costByJob.get(p.jobId) ?? []).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    const attempts = o?.attemptLog.length ?? p.attempts;
    if (cs.length !== attempts) problems.push(`packet ${p.id.slice(0, 8)}: ${cs.length} cost rows, ${attempts} attempts`);
    else tied += cs.length;
    const sum = cs.reduce((a, c) => a + c.usd, 0);
    if (Math.abs(sum - p.usd) > 1e-7) problems.push(`packet ${p.id.slice(0, 8)}: cost rows sum to ${sum.toFixed(8)}, the packet says ${p.usd.toFixed(8)}`);
    if (o && Math.abs(sum - o.usd) > 1e-7) problems.push(`packet ${p.id.slice(0, 8)}: cost rows sum to ${sum.toFixed(8)}, the saved answer says ${o.usd.toFixed(8)}`);
  }
  const orphan = costs.filter((c) => !c.refId || !packets.some((p) => p.jobId === c.refId)).length;
  const total = costs.reduce((a, c) => a + c.usd, 0);
  out(`Cost rows ${costs.length}, USD ${total.toFixed(4)} in all; ${tied} rows tie one to one to an attempt of a packet in the run; ${orphan} rows belong to no packet of the run. Rows recorded by our own client from the provider's usage field; the provider's bill is not in the snapshot and completeness against it is not established here.`);
  if (problems.length) {
    out();
    for (const p of problems) out(`- ${p}`);
  } else out("Every packet's cost rows count its attempts and sum to the USD the packet and the saved answer carry.");
  out();

  const text = lines.join("\n") + "\n";
  writeFileSync(join(dir, "reconciliation.md"), text);
  console.log(text);
}

main();
