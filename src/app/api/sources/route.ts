import { asc } from "drizzle-orm";
import { dbHttp } from "@/db/client";
import { sources } from "@/db/schema";

/** The source registry with health, for the settings page. Never prerendered. */
export const dynamic = "force-dynamic";

export async function GET() {
  const rows = await dbHttp()
    .select({
      id: sources.id,
      family: sources.family,
      tenant: sources.tenant,
      companyName: sources.companyName,
      companyDomain: sources.companyDomain,
      active: sources.active,
      lastPolledAt: sources.lastPolledAt,
      lastStatus: sources.lastStatus,
      lastError: sources.lastError,
      consecutiveFailures: sources.consecutiveFailures,
      jobCount: sources.jobCount,
    })
    .from(sources)
    .orderBy(asc(sources.family), asc(sources.companyName));
  return Response.json({ sources: rows });
}
