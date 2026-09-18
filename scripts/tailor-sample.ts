import { dbPool } from "@/db/client";
import { resumeFacts } from "@/server/match/profile";
import { cellStats, citationStats, runStats } from "@/server/match/report";
import { loadScoringJobs } from "@/server/match/run";
import { stratifiedSample } from "@/server/match/sample";
import { baseResume, factEntries } from "@/server/packet/resume";
import { tailorJob, type TailorOutcome } from "@/server/packet/run";
import { factSet, isHard, needsReview, validateChangeSet } from "@/server/packet/validate";
import type { ResumeFacts } from "@/server/match/profile";
import { factsBlock } from "@/server/packet/tailor";
import { filterFacts } from "@/server/profile/viewer";
import { currentUserId } from "@/server/user";
import { oneOf, parseFlags, positiveInteger } from "@/lib/cli";
import { CITATION_KIND, CITATION_KINDS, codeOf, type FindingCode } from "@/server/packet/codes";
import { answersHeader, savedAnswer, writeAnswers, type SavedAnswer } from "@/server/packet/answers";
import { PROMPT_REVISION } from "@/server/packet/tailor";
import { VALIDATOR_REVISION } from "@/server/packet/validate";
import { env } from "@/lib/env";

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
 *   npm run tailor-sample -- --no-store          cost rows only, never a packet: a measurement that leaves the stored packets as they are
 *   npm run tailor-sample -- --save out.json      every outcome's change sets and posting lemmas, so a rule can be re-read on the same answers without a call
 *
 * Flags are typed (src/lib/cli.ts): --dry and --no-store take no value and
 * read the same in any position, --n and --only are validated, an unknown
 * flag is refused, and the parsed flags are printed before anything runs.
 */

const FLAGS = { booleans: ["dry", "no-store"], values: ["n", "only", "model", "tag", "save"] } as const;

async function pool<T, R>(items: T[], n: number, fn: (t: T) => Promise<R>, each?: (r: R, done: number) => void): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  let done = 0;
  const worker = async () => {
    for (;;) {
      const i = next++;
      if (i >= items.length) return;
      out[i] = await fn(items[i]);
      done += 1;
      // Each outcome is handed over as it lands, so a run that dies has everything it had finished (finding 18).
      each?.(out[i], done);
    }
  };
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, worker));
  return out;
}

/**
 * The posting signal's two scopes on the same fresh answers (D-023): every
 * attempt's change set validated again with the posting noun counted
 * anywhere in the line, and only in a claim position. The rule that ran
 * the retry loop is the claim scope; the anywhere figures are the same
 * answers re-read under the earlier rule, not a second generation.
 */
function scopes(facts: ResumeFacts, outcomes: TailorOutcome[]) {
  const set = factSet(factEntries(facts));
  const base = baseResume(facts);
  const status = (findings: ReturnType<typeof validateChangeSet>) => (isHard(findings) ? "invalid" : needsReview(findings) ? "needs_review" : "ready");
  const count = (which: "first" | "last" | "retained", scope: "anywhere" | "claim") => {
    const out = { ready: 0, needs_review: 0, invalid: 0, failed: 0 };
    for (const o of outcomes) {
      const i = which === "first" ? 0 : which === "last" ? o.changeSets.length - 1 : o.selected;
      const cs = o.changeSets[i];
      if (!cs) {
        out.failed += 1;
        continue;
      }
      out[status(validateChangeSet(cs, base, set, o.posting, scope))] += 1;
    }
    return out;
  };
  console.log("  posting scope on the same answers, packets:");
  // Three attempts are reported apart: the first, the last, and the retained one the packet stores, which differs from the last when a
  // held answer was kept over a rejected retry (review four, finding 13).
  console.table({
    "first answers, anywhere": count("first", "anywhere"),
    "first answers, claim position": count("first", "claim"),
    "last answers, anywhere": count("last", "anywhere"),
    "last answers, claim position": count("last", "claim"),
    "retained answers, anywhere": count("retained", "anywhere"),
    "retained answers, claim position": count("retained", "claim"),
  });
  // What the narrowing releases: posting words that fire anywhere and not in a claim position, on the final answers, by word.
  const released = new Map<string, number>();
  for (const o of outcomes) {
    const cs = o.changeSets[o.selected];
    if (!cs) continue;
    const wide = validateChangeSet(cs, base, set, o.posting, "anywhere").filter((f) => f.message.startsWith("word from the posting"));
    const narrow = new Set(validateChangeSet(cs, base, set, o.posting, "claim").filter((f) => f.message.startsWith("word from the posting")).map((f) => `${f.bullet}:${f.value}`));
    for (const f of wide) if (!narrow.has(`${f.bullet}:${f.value}`)) released.set(String(f.value), (released.get(String(f.value)) ?? 0) + 1);
  }
  console.log("  posting words released by the claim position, final answers, by word:", JSON.stringify(Object.fromEntries([...released.entries()].sort((a, b) => b[1] - a[1]))));
  const lines: string[] = [];
  for (const o of outcomes) {
    const cs = o.changeSets[o.selected];
    if (!cs) continue;
    const wide = validateChangeSet(cs, base, set, o.posting, "anywhere").filter((f) => f.message.startsWith("word from the posting"));
    const narrow = new Set(validateChangeSet(cs, base, set, o.posting, "claim").filter((f) => f.message.startsWith("word from the posting")).map((f) => `${f.bullet}:${f.value}`));
    for (const f of wide) {
      if (narrow.has(`${f.bullet}:${f.value}`)) continue;
      const line = cs.changes.find((c) => c.bullet === f.bullet)?.text ?? cs.summary ?? "";
      lines.push(`    ${f.value}: ${line}`);
    }
  }
  console.log("  released, the lines, first 25 of " + lines.length);
  for (const l of [...new Set(lines)].slice(0, 25)) console.log(l);
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
  // What held or rejected the first answers, what holds the packets as stored, and what the retry cleared: by message, counted by edit.
  const byMessage = (fs: { level: string; message: string }[]) => {
    const m = new Map<string, number>();
    for (const f of fs) m.set(`${f.level}: ${f.message}`, (m.get(`${f.level}: ${f.message}`) ?? 0) + 1);
    return Object.fromEntries([...m.entries()].sort((a, b) => b[1] - a[1]));
  };
  console.log("  first answers, findings by message:", JSON.stringify(byMessage(outcomes.flatMap((o) => o.attemptLog[0]?.findings ?? []))));
  console.log("  stored packets, findings by message:", JSON.stringify(byMessage(outcomes.flatMap((o) => o.findings.filter((f) => f.level !== "soft")))));
  const cleared = outcomes.filter((o) => o.attempts > 1 && o.status === "ready").flatMap((o) => o.attemptLog[0]?.findings ?? []);
  console.log("  findings the retry cleared, by message:", JSON.stringify(byMessage(cleared)));
  console.log("  packets held as stored, by the reasons that hold them:", JSON.stringify(byMessage(outcomes.filter((o) => o.status === "needs_review").map((o) => ({ level: "packet", message: [...new Set(o.findings.filter((f) => f.level === "review").map((f) => f.message))].sort().join(" + ") })))));
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
  // Lines not supported by what they cite, split by kind and counted by stable code, never by message (finding 17).
  // The message used to be matched here because it had moved between levels; a code moves nowhere, and a finding
  // whose code this build does not know is counted as unrecognised rather than as none of the kinds.
  const edits = outcomes.reduce((a, o) => a + o.changes, 0);
  const lines = (pick: (c: FindingCode | null) => boolean) =>
    new Set(outcomes.flatMap((o) => o.findings.filter((f) => f.bullet && pick(codeOf(f))).map((f) => `${o.jobId}:${f.bullet}`))).size;
  const byKind = CITATION_KINDS.map((k) => `${k} ${lines((c) => !!c && CITATION_KIND[c] === k)}`).join(", ");
  const any = lines((c) => !!c && !!CITATION_KIND[c]);
  const unrecognised = lines((c) => c === null);
  console.log(`  lines not supported by what they cite: ${any} of ${edits} edits, ${edits ? ((100 * any) / edits).toFixed(2) : "0"} per 100; by kind ${byKind}; unrecognised ${unrecognised}`);
  for (const o of outcomes.filter((x) => x.status !== "ready").slice(0, 8)) {
    console.log(`  ${o.status} ${o.jobId}: ${o.error ?? o.findings.filter((f) => f.level === "hard").map((f) => `${f.bullet}: ${f.message} ${f.value ?? ""}`).join("; ")}`);
  }
}

async function main() {
  const { booleans, values } = parseFlags(process.argv.slice(2), FLAGS);
  const n = positiveInteger(values.n, "n", 100);
  const only = oneOf(values.only, "only", ["changes", "document"]);
  const dry = booleans.dry;
  const model = values.model;
  const tag = values.tag ?? `sample-${new Date().toISOString().slice(0, 10)}`;
  const store = !booleans["no-store"];
  const save = values.save;
  console.log(`flags: n ${n}, only ${only ?? "both"}, dry ${dry}, store ${store}, tag ${tag}, model ${model ?? "default"}, save ${save ?? "none"}`);
  const db = dbPool();
  const userId = await currentUserId();
  const [facts, filter] = await Promise.all([resumeFacts(db, userId), filterFacts(userId, db)]);
  if (!facts || !filter) throw new Error("the demo user has no confirmed profile; run npm run seed");
  const block = factsBlock(factEntries(facts));
  console.log(`facts message: ${block.length} chars, about ${Math.ceil(block.length / 4)} tokens by the chars/4 rule, ${factEntries(facts).length} facts`);

  const sample = await stratifiedSample(db, userId, filter, n);
  console.log(`candidates ${sample.candidates} in ${sample.cells.length} cells; sample ${sample.chosen.length}; by family ${JSON.stringify(sample.byFamily)}`);
  if (dry) {
    console.table(sample.cells);
    return;
  }
  const jobsById = await loadScoringJobs(db, sample.chosen);
  const jobs = sample.chosen.map((id) => jobsById.get(id)!).filter(Boolean);

  if (only !== "document") {
    const run = `${tag}-changes`;
    // The header says what produced these answers, so a measurement reading them next week is not told by hand (finding 18).
    const header = save
      ? answersHeader({
          run,
          startedAt: new Date().toISOString(),
          model: model ?? env().MODEL_TAILOR ?? "gpt-5.6-luna",
          promptRevision: PROMPT_REVISION,
          validatorRevision: VALIDATOR_REVISION,
          factsHash: facts.factsHash,
          baseResume: baseResume(facts),
          jobs: jobs.length,
        })
      : null;
    const saved: SavedAnswer[] = [];
    const outcomes = await pool(
      jobs,
      5,
      (job) => tailorJob(db, facts, job, { mode: "changes", model, run, store }),
      (o, done) => {
        if (!save || !header) return;
        // Written after every outcome, through a temporary file and a rename: the cost of a crash is one answer.
        saved.push(savedAnswer(o));
        writeAnswers(save, header, saved);
        if (done === 1 || done % 10 === 0 || done === jobs.length) console.log(`  saved ${done} of ${jobs.length} to ${save}`);
      },
    );
    summarise(run, outcomes);
    scopes(facts, outcomes);
    if (save) console.log(`saved ${saved.length} outcomes to ${save}, header run ${run}, prompt ${PROMPT_REVISION}, validator ${VALIDATOR_REVISION}, facts ${facts.factsHash.slice(0, 12)}`);
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
