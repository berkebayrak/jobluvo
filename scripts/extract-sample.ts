import { readFileSync } from "node:fs";
import { dbPool } from "@/db/client";
import { costEvents } from "@/db/schema";
import { runStats } from "@/server/match/report";
import { JACK_RESUME } from "@/server/profile/demo";
import { extractCall, ExtractError, type ExtractedFact } from "@/server/profile/extract";
import { currentUserId } from "@/server/user";
import { oneOf, parseFlags, positiveInteger } from "@/lib/cli";

/*
 * The third term of the cost per application: extraction per user. One
 * call per resume, so the sample is small: the same resume N times, as the
 * PDF the API renders and as plain text, both tagged in cost_events and
 * neither stored as facts. The facts are compared with the seeded facts
 * the PDF was rendered from, so the sample also says how much of a known
 * resume the extractor reads back exactly.
 *
 *   npm run extract-sample                 5 runs each way
 *   npm run extract-sample -- --n 3
 *   npm run extract-sample -- --only pdf|text
 *   npm run extract-sample -- --tag sample-x
 */

const FLAGS = { booleans: [], values: ["n", "only", "tag"] } as const;

/** How much of the seeded resume came back exactly: roles, bullets, degrees, skills, answers. */
function accuracy(facts: ExtractedFact[]) {
  const emp = facts.filter((f) => f.kind === "employment").map((f) => f.data as { company: string; title: string; start: string; end?: string; bullets: string[] });
  const roles = JACK_RESUME.employment.filter((e) => emp.some((x) => x.company === e.company && x.title === e.title && x.start === e.start && (x.end ?? undefined) === e.end)).length;
  const bulletsAll = JACK_RESUME.employment.flatMap((e) => e.bullets);
  const got = new Set(emp.flatMap((x) => x.bullets));
  const bullets = bulletsAll.filter((b) => got.has(b)).length;
  const edu = facts.filter((f) => f.kind === "education").map((f) => f.data as { institution: string; degree: string });
  const degrees = JACK_RESUME.education.filter((e) => edu.some((x) => x.institution === e.institution && x.degree === e.degree)).length;
  const skillNames = new Set(facts.filter((f) => f.kind === "skill").map((f) => (f.data as { name: string }).name));
  const skills = JACK_RESUME.skills.filter(([n]) => skillNames.has(n)).length;
  const ans = facts.filter((f) => f.kind === "answer");
  return {
    roles: `${roles}/${JACK_RESUME.employment.length}`,
    bullets: `${bullets}/${bulletsAll.length}`,
    degrees: `${degrees}/${JACK_RESUME.education.length}`,
    skills: `${skills}/${JACK_RESUME.skills.length}`,
    /** The resume states no answers; any read back would be invented. */
    answers: ans.length,
    extra: facts.length - (emp.length + edu.length + skillNames.size + ans.length),
  };
}

async function main() {
  const { values } = parseFlags(process.argv.slice(2), FLAGS);
  const n = positiveInteger(values.n, "n", 5);
  const only = oneOf(values.only, "only", ["pdf", "text"]);
  const tag = values.tag ?? `sample-${new Date().toISOString().slice(0, 10)}`;
  console.log(`flags: n ${n}, only ${only ?? "both"}, tag ${tag}`);
  const db = dbPool();
  const userId = await currentUserId();
  const bytes = readFileSync("scripts/fixtures/jack-miller-resume.pdf");
  const text = readFileSync("scripts/fixtures/jack-miller-resume.txt", "utf8");
  console.log(`resume: ${bytes.length} bytes as PDF, ${text.length} chars as text`);

  for (const kind of ["pdf", "text"] as const) {
    if (only && only !== kind) continue;
    const run = `${tag}-${kind}`;
    const rows: Record<string, unknown>[] = [];
    for (let i = 0; i < n; i += 1) {
      try {
        const r = await extractCall(kind === "pdf" ? { kind, filename: "jack-miller-resume.pdf", bytes } : { kind, text });
        await db.insert(costEvents).values({ kind: "extract", model: r.model, userId, refId: `sample:${kind}:${i}`, tokensIn: r.usage.inputTokens, tokensCached: r.usage.cachedInputTokens, tokensOut: r.usage.outputTokens, usd: r.usd, ms: r.ms, run });
        rows.push({ run: i, in: r.usage.inputTokens, cached: r.usage.cachedInputTokens, out: r.usage.outputTokens, usd: r.usd.toFixed(6), ms: r.ms, facts: r.facts.length, issues: r.issues.length, ...accuracy(r.facts) });
        if (r.issues.length) console.log(`  ${run} ${i} issues: ${r.issues.join(" | ")}`);
      } catch (e) {
        if (e instanceof ExtractError && e.usage) {
          await db.insert(costEvents).values({ kind: "extract", model: e.model, userId, refId: `sample:${kind}:${i}`, tokensIn: e.usage.inputTokens, tokensCached: e.usage.cachedInputTokens, tokensOut: e.usage.outputTokens, usd: e.usd, ms: e.ms, run });
        }
        rows.push({ run: i, error: e instanceof Error ? e.message : String(e) });
      }
    }
    console.log(`\n${run}`);
    console.table(rows);
  }
  console.log("\nUSD per call by kind and run");
  console.table((await runStats(db)).filter((r) => r.kind === "extract"));
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
