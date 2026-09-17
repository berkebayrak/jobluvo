import { neon, type NeonQueryFunction } from "@neondatabase/serverless";
import { eligibilityOf, sponsorshipOf } from "@/server/jobs/normalize";

/**
 * Recomputes the sponsorship and eligibility signals of every job from its
 * stored description text with the current detectors.
 * `npm run db:backfill-signals`.
 *
 * Safe to run any number of times. Both signals are read from
 * description_text, which is stored whole, and content_hash reads only the
 * title, the raw locations and the boilerplate free core, so a recompute
 * cannot change a hash, cannot look like changed content and cannot trigger
 * a rescore.
 */

async function counts(sql: NeonQueryFunction<false, false>) {
  return (await sql`
    select sponsorship::text as signal, count(*)::int as jobs from jobs where closed_at is null group by 1
    union all
    select 'eligibility: ' || coalesce(eligibility::text, 'none'), count(*)::int from jobs where closed_at is null group by 1
    order by 1`) as { signal: string; jobs: number }[];
}

async function main() {
  const sql = neon(process.env.DATABASE_URL!);
  console.log("before");
  console.table(await counts(sql));

  const rows = (await sql`
    select id, description_text, sponsorship::text as sponsorship, sponsorship_evidence, eligibility::text as eligibility,
      eligibility_country, eligibility_evidence from jobs`) as {
    id: string;
    description_text: string;
    sponsorship: string;
    sponsorship_evidence: string | null;
    eligibility: string | null;
    eligibility_country: string | null;
    eligibility_evidence: string | null;
  }[];

  const updates: unknown[][] = [];
  for (const r of rows) {
    const sp = sponsorshipOf(r.description_text);
    const el = eligibilityOf(r.description_text);
    const next = [sp.value, sp.evidence ?? null, el?.restriction ?? null, el?.country ?? null, el?.evidence ?? null];
    const prior = [r.sponsorship, r.sponsorship_evidence, r.eligibility, r.eligibility_country, r.eligibility_evidence];
    if (next.some((v, i) => v !== prior[i])) updates.push([r.id, ...next]);
  }

  const chunk = 200;
  for (let i = 0; i < updates.length; i += chunk) {
    const slice = updates.slice(i, i + chunk);
    const values = slice
      .map((_, k) => {
        const b = k * 6;
        return `($${b + 1}::uuid, $${b + 2}::sponsorship, $${b + 3}, $${b + 4}::restriction, $${b + 5}, $${b + 6})`;
      })
      .join(", ");
    await sql.query(
      `update jobs as j set sponsorship = v.sponsorship, sponsorship_evidence = v.sponsorship_evidence,
         eligibility = v.eligibility, eligibility_country = v.eligibility_country, eligibility_evidence = v.eligibility_evidence
       from (values ${values}) as v(id, sponsorship, sponsorship_evidence, eligibility, eligibility_country, eligibility_evidence)
       where j.id = v.id`,
      slice.flat(),
    );
  }
  console.log(`scanned ${rows.length} jobs, updated ${updates.length}`);

  console.log("after");
  console.table(await counts(sql));
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
