import { and, eq } from "drizzle-orm";
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
 *
 * **Two things are printed and they are not the same thing** (the ninth
 * review's findings 4 and 5). The execution is what this call did. The
 * artifact is what the row holds, which may be an earlier execution's, because
 * a run that produces no document leaves the one already there (D-051). They
 * are printed under separate headings, each with its own findings, because
 * printing this execution's findings and then the stored document said "stored
 * with the findings above" about findings that explain neither.
 */
async function main() {
  const jobId = process.argv[2];
  if (!jobId || jobId.startsWith("--")) throw new Error("usage: npm run tailor -- <job id> [--document]");
  const mode = process.argv.includes("--document") ? "document" : "changes";
  const db = dbPool();
  const userId = await currentUserId();
  const out = await tailorForUser(db, userId, jobId, { mode });
  if (!out) throw new Error("the demo user has no confirmed profile");

  console.log(`\nthis execution: ${out.status} after ${out.attempts} attempt(s), ${out.changes} change(s), in ${out.tokensIn} (cached ${out.tokensCached}) out ${out.tokensOut}, usd ${out.usd.toFixed(6)}, ${out.ms}ms`);
  if (out.error) console.log(`error: ${out.error}`);
  for (const f of out.findings) console.log(`  ${f.level}  ${f.bullet ?? "-"}  ${f.message}${f.value ? `  (${f.value})` : ""}`);

  const facts = (await resumeFacts(db, userId))!;
  // Scoped to the user as well as the job. A packet is unique per user and job, and filtering on the job alone
  // picks any user's row: with a second user on the database this printed someone else's findings and rendered
  // their resume under this user's name, because the render reads the row (the ninth review's finding 4).
  const [p] = await db
    .select({ status: packets.status, changes: packets.changes, resume: packets.resume, findings: packets.findings, attempt: packets.attempt, validatorRev: packets.validatorRev })
    .from(packets)
    .where(and(eq(packets.userId, userId), eq(packets.jobId, jobId)));
  if (!p) {
    console.log("\nno packet is stored for this user and this job, so there is no artifact to show.");
    return;
  }

  // Whether the row is this execution's is read from what this execution wrote, never from comparing the two
  // statuses: two executions can share a status, so a preserved row whose earlier execution also ended invalid
  // looks like a row this one wrote (finding 5).
  if (out.storedAs === "execution") {
    console.log(
      `\nthis execution produced no document, so the row keeps the artifact an earlier execution left and only the error moved (D-051). Everything below describes that earlier artifact, not the execution above.`,
    );
  }

  console.log(`\nstored artifact: ${p.status}${p.attempt ? `, attempt ${p.attempt}` : ""}, validator ${p.validatorRev ?? "unstamped"}`);
  if (!p.findings.length) console.log("  no findings stored");
  for (const f of p.findings) console.log(`  ${f.level}  ${f.bullet ?? "-"}  ${f.message}${f.value ? `  (${f.value})` : ""}`);

  const base = baseResume(facts);
  const { diff } = applyChanges(base, { summary: p.resume?.summary ?? null, summaryFacts: [], changes: p.changes, skills: [] });
  console.log("\ndiff of the stored artifact");
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
    return;
  }
  if (!p.resume) {
    console.log("\nthe row holds no document.");
    return;
  }
  // Each non consumable status is a different thing and saying "held for review" about all of them was wrong.
  console.log(
    `\n${
      p.status === "needs_review"
        ? "held for review: the document is stored with the findings above and is not consumable until a person resolves them (D-017)"
        : p.status === "invalid"
          ? "rejected: the document is kept so a person can read what was written, and the status is what stops it being served (D-038)"
          : p.status === "failed"
            ? "the execution that wrote this row failed after its answer parsed, so the document was kept and nothing has ever assessed it (D-045, D-050)"
            : `not consumable: the row is ${p.status}`
    }`,
  );
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
