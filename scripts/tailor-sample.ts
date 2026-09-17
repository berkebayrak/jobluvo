import { dbPool } from "@/db/client";
import { resumeFacts } from "@/server/match/profile";
import { cellStats, citationStats, runStats } from "@/server/match/report";
import { loadScoringJobs } from "@/server/match/run";
import { stratifiedSample } from "@/server/match/sample";
import { factEntries } from "@/server/packet/resume";
import { tailorJob, type TailorOutcome } from "@/server/packet/run";
import { factsBlock } from "@/server/packet/tailor";
import { filterFacts } from "@/server/profile/viewer";
import { currentUserId } from "@/server/user";

/*
 * The tailoring half of the phase 0 instrument (D-003): the same 100 jobs
 * as the scoring sample, tailored twice on the same model:
 *
 *   <tag>-changes    the model emits edits only, the code assembles the
 *                    document; writes packets and cost rows
 *   <tag>-document   the model emits the whole resume; writes cost rows
 *                    only, tagged, never a packet
 *
 * The difference between the two is what the change set saves. Both go
 * through the validator, so the report also says how often each mode is
 * rejected, retried and stored invalid.
 *
 *   npm run tailor-sample                        both modes, 100 jobs
 *   npm run tailor-sample -- --n 20              fewer jobs
 *   npm run tailor-sample -- --only changes      one mode
 *   npm run tailor-sample -- --dry               print the sample, call nothing
 *   npm run tailor-sample -- --tag sample-x      the run tag prefix, default sample-<today>
 *   npm run tailor-sample -- --model gpt-5.6-x   another priced model
 */

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? (process.argv[i + 1] ?? "true") : undefined;
}

async function pool<T, R>(items: T[], n: number, fn: (t: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  const worker = async () => {
    for (;;) {
      const i = next++;
      if (i >= items.length) return;
      out[i] = await fn(items[i]);
    }
  };
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, worker));
  return out;
}

function summarise(run: string, outcomes: TailorOutcome[]) {
  const by = (s: TailorOutcome["status"]) => outcomes.filter((o) => o.status === s).length;
  const retried = outcomes.filter((o) => o.attempts > 1).length;
  const usd = outcomes.reduce((a, o) => a + o.usd, 0);
  // The retry measured: what a held or rejected first answer became after it (D-022). Reported, never derived.
  const after = (first: TailorOutcome["status"]) => {
    const xs = outcomes.filter((o) => o.attempts > 1 && o.attemptLog[0]?.outcome === first);
    const n = (s: TailorOutcome["status"]) => xs.filter((o) => o.status === s).length;
    return `${xs.length}: now ready ${n("ready")}, held ${n("needs_review")}, invalid ${n("invalid")}, failed ${n("failed")}`;
  };
  console.log(`retried after a held first answer ${after("needs_review")}; retried after a rejected first answer ${after("invalid")}`);
  const hard = outcomes.flatMap((o) => o.findings.filter((f) => f.level === "hard"));
  const soft = outcomes.flatMap((o) => o.findings.filter((f) => f.level === "soft"));
  console.log(
    `\n${run}: ready ${by("ready")}, held for review ${by("needs_review")}, invalid ${by("invalid")}, failed ${by("failed")}, retried ${retried}, usd ${usd.toFixed(4)}, ` +
      `changes per packet ${(outcomes.reduce((a, o) => a + o.changes, 0) / Math.max(1, outcomes.length)).toFixed(1)}, ` +
      `max cached tokens ${Math.max(0, ...outcomes.map((o) => o.tokensCached))}`,
  );
  const count = (fs: typeof hard) => {
    const m = new Map<string, number>();
    for (const f of fs) m.set(f.message, (m.get(f.message) ?? 0) + 1);
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  };
  console.log("  hard findings on the stored attempt:", JSON.stringify(count(hard)));
  console.log("  soft findings on the stored attempt:", JSON.stringify(count(soft)));
  // The wrong citation rate, tracked across samples: edits whose cited facts do not carry a value the edit uses.
  // Matched on the message across every level, never on a level: the message moved from soft to hard when the
  // cited value rule shipped, and a level filter printed "0" for two samples because it found nothing, not
  // because nothing was wrong (review finding 16). Counted by packet and edit, so R1.1 in two jobs is two.
  const edits = outcomes.reduce((a, o) => a + o.changes, 0);
  const wrong = new Set(outcomes.flatMap((o) => o.findings.filter((f) => f.message.includes("not in the cited facts")).map((f) => `${o.jobId}:${f.bullet}`))).size;
  console.log(`  wrong citations: ${wrong} of ${edits} edits, ${edits ? ((100 * wrong) / edits).toFixed(2) : "0"} per 100`);
  for (const o of outcomes.filter((x) => x.status !== "ready").slice(0, 8)) {
    console.log(`  ${o.status} ${o.jobId}: ${o.error ?? o.findings.filter((f) => f.level === "hard").map((f) => `${f.bullet}: ${f.message} ${f.value ?? ""}`).join("; ")}`);
  }
}

async function main() {
  const n = Number(arg("n") ?? 100);
  const only = arg("only");
  const dry = arg("dry") === "true";
  const model = arg("model");
  const tag = arg("tag") ?? `sample-${new Date().toISOString().slice(0, 10)}`;
  const db = dbPool();
  const userId = await currentUserId();
  const [facts, filter] = await Promise.all([resumeFacts(db, userId), filterFacts(userId, db)]);
  if (!facts || !filter) throw new Error("the demo user has no confirmed profile; run npm run seed");
  const block = factsBlock(factEntries(facts));
  console.log(`facts message: ${block.length} chars, about ${Math.ceil(block.length / 4)} tokens by the chars/4 rule, ${factEntries(facts).length} facts`);

  const sample = await stratifiedSample(db, userId, filter, n);
  console.log(`candidates ${sample.candidates} in ${sample.cells.length} cells; sample ${sample.chosen.length}`);
  if (dry) {
    console.table(sample.cells);
    return;
  }
  const jobsById = await loadScoringJobs(db, sample.chosen);
  const jobs = sample.chosen.map((id) => jobsById.get(id)!).filter(Boolean);

  if (only !== "document") {
    const run = `${tag}-changes`;
    const outcomes = await pool(jobs, 5, (job) => tailorJob(db, facts, job, { mode: "changes", model, run, store: true }));
    summarise(run, outcomes);
  }
  if (only !== "changes") {
    const run = `${tag}-document`;
    const outcomes = await pool(jobs, 5, (job) => tailorJob(db, facts, job, { mode: "document", model, run, store: false }));
    summarise(run, outcomes);
  }

  console.log("\nwrong citations by run, from the packets on hand");
  console.table(await citationStats(db));
  console.log("\nUSD per call by kind and run");
  console.table((await runStats(db)).filter((r) => r.kind === "tailor" || r.run.startsWith(tag)));
  for (const by of ["family", "length"] as const) {
    console.log(`by ${by}`);
    console.table((await cellStats(db, by)).filter((c) => c.kind === "tailor" && c.run.startsWith(tag)));
  }
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
