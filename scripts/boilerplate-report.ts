import { neon } from "@neondatabase/serverless";
import { BOILERPLATE_MIN_LENGTH, boilerplateMinCount, detectRepeated, paragraphsOf } from "@/server/jobs/normalize";

/**
 * What the boilerplate rule strips, per board, under the old rule (any
 * paragraph two jobs share), a flat three, and shares of the board, over the
 * stored complete descriptions.
 * `npm run boilerplate-report`. Prints the paragraphs the current rule stops
 * stripping, so the change can be read rather than trusted.
 */
async function main() {
  const sql = neon(process.env.DATABASE_URL!);
  const boards = (await sql`
    select s.family, s.tenant, count(*)::int as jobs from jobs j join sources s on s.id = j.source_id
    where j.closed_at is null and j.description_text <> '' group by 1, 2 order by 3 desc`) as { family: string; tenant: string; jobs: number }[];

  const summary: Record<string, unknown>[] = [];
  const released: { board: string; shared_by: number; paragraph: string }[] = [];
  for (const b of boards) {
    const rows = (await sql`
      select j.description_text from jobs j join sources s on s.id = j.source_id
      where s.tenant = ${b.tenant} and j.closed_at is null and j.description_text <> ''`) as { description_text: string }[];
    const texts = rows.map((r) => r.description_text);
    const old = detectRepeated(texts, 2);
    const current = detectRepeated(texts);
    const threshold = boilerplateMinCount(texts.length);
    summary.push({
      board: `${b.family}/${b.tenant}`,
      jobs: texts.length,
      "2 jobs (old)": old.length,
      "3 jobs": detectRepeated(texts, 3).length,
      "1 in 20, min 3 (current)": current.length,
      "1 in 10, min 3": detectRepeated(texts, Math.max(3, Math.ceil(texts.length * 0.1))).length,
      threshold,
      released: old.length - current.length,
    });
    const counts = new Map<string, number>();
    for (const t of texts) for (const p of new Set(paragraphsOf(t, BOILERPLATE_MIN_LENGTH))) counts.set(p, (counts.get(p) ?? 0) + 1);
    for (const p of old) if (!current.includes(p)) released.push({ board: b.tenant, shared_by: counts.get(p) ?? 0, paragraph: p.slice(0, 110) });
  }
  console.log("paragraphs treated as boilerplate, per board");
  console.table(summary);
  console.log("paragraphs the current rule stops stripping, most shared first");
  console.table(released.sort((x, y) => y.shared_by - x.shared_by).slice(0, 30));
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
