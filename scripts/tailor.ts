import { eq } from "drizzle-orm";
import { dbPool } from "@/db/client";
import { packets, users } from "@/db/schema";
import { resumeFacts } from "@/server/match/profile";
import { applyChanges, baseResume, renderResume } from "@/server/packet/resume";
import { consumableResume, tailorForUser } from "@/server/packet/run";
import { currentUserId } from "@/server/user";

/**
 * Tailors the demo user's resume to one job and prints the diff and the
 * findings, the way the review screen will show them. Writes the packet.
 * `npm run tailor -- <job id>`, or `-- <job id> --document` for the whole
 * document mode.
 */
async function main() {
  const jobId = process.argv[2];
  if (!jobId || jobId.startsWith("--")) throw new Error("usage: npm run tailor -- <job id> [--document]");
  const mode = process.argv.includes("--document") ? "document" : "changes";
  const db = dbPool();
  const userId = await currentUserId();
  const out = await tailorForUser(db, userId, jobId, { mode });
  if (!out) throw new Error("the demo user has no confirmed profile");
  console.log(`${out.status} after ${out.attempts} attempt(s), ${out.changes} change(s), in ${out.tokensIn} (cached ${out.tokensCached}) out ${out.tokensOut}, usd ${out.usd.toFixed(6)}, ${out.ms}ms`);
  if (out.error) console.log(`error: ${out.error}`);
  for (const f of out.findings) console.log(`  ${f.level}  ${f.bullet ?? "-"}  ${f.message}${f.value ? `  (${f.value})` : ""}`);
  const facts = (await resumeFacts(db, userId))!;
  const [p] = await db.select({ status: packets.status, changes: packets.changes, resume: packets.resume }).from(packets).where(eq(packets.jobId, jobId));
  const base = baseResume(facts);
  const { diff } = applyChanges(base, { summary: p.resume?.summary ?? null, summaryFacts: [], changes: p.changes, skills: [] });
  console.log("\ndiff");
  for (const d of diff) {
    console.log(`  ${d.bullet}${d.facts.length ? `  [${d.facts.join(", ")}]` : ""}`);
    if (d.before) console.log(`  - ${d.before}`);
    console.log(`  + ${d.after}`);
  }
  // Rendered only through the one door downstream: a held packet's resume stays with its findings until a person
  // resolves it. The question is asked of the ROW and never of the outcome, because the outcome describes this
  // execution and a run that produced no document leaves an earlier run's document on the row (D-051).
  const consumable = consumableResume(p);
  if (consumable) {
    const [u] = await db.select({ name: users.name }).from(users).where(eq(users.id, userId));
    console.log(`\n${renderResume(u.name, consumable)}`);
  } else if (p.resume) {
    console.log(`\nheld for review: the resume is stored with the findings above and is not consumable until a person resolves them (D-017)`);
  }
  if (out.status !== p.status) console.log(`\nthis execution ended ${out.status}; the stored packet is ${p.status} and comes from an earlier run (D-051)`);
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
