import { eq, sql } from "drizzle-orm";
import type { NextRequest } from "next/server";
import { dbHttp } from "@/db/client";
import { jobs } from "@/db/schema";

/** One job with its group members listed, so a card can show where else it appears. */
export async function GET(_req: NextRequest, ctx: RouteContext<"/api/jobs/[id]">) {
  const { id } = await ctx.params;
  const db = dbHttp();
  const rows = await db.select().from(jobs).where(eq(jobs.id, id)).limit(1);
  if (!rows.length) return Response.json({ error: "not found" }, { status: 404 });
  const job = rows[0];
  const members = await db.execute<Record<string, unknown>>(sql`
    select o.id, o.family, o.apply_url, o.closed_at, l.reason, l.score
    from job_group_links me
    join job_group_links l on l.group_id = me.group_id
    join jobs o on o.id = l.job_id
    where me.job_id = ${id}
    order by o.first_seen_at asc
  `);
  return Response.json({
    job: { ...job, descriptionHtml: undefined },
    descriptionHtml: job.descriptionHtml,
    group: members.rows,
  });
}
