import { parseCompensation } from "@/server/jobs/normalize";
import type { Adapter, RawPosting } from "./types";
import { fetchJson, toDate } from "./types";

interface AshbyJob {
  id: string;
  title: string;
  location?: string;
  secondaryLocations?: { location?: string }[];
  employmentType?: string;
  isRemote?: boolean;
  isListed?: boolean;
  workplaceType?: string;
  publishedAt?: string;
  jobUrl?: string;
  applyUrl?: string;
  descriptionHtml?: string;
  compensation?: { compensationTierSummary?: string; scrapeableCompensationSalarySummary?: string };
}

/** Ashby posting API. Compensation arrives as a display string and is parsed. */
export const ashby: Adapter = {
  family: "ashby",
  async fetch(source) {
    const url = `https://api.ashbyhq.com/posting-api/job-board/${encodeURIComponent(source.tenant)}?includeCompensation=true`;
    const res = await fetchJson<{ jobs: AshbyJob[] }>(url, source.etag);
    if (!res) return { notModified: true };
    const postings: RawPosting[] = res.json.jobs
      .filter((j) => j.isListed !== false)
      .map((j) => {
        const locations = [j.location, ...(j.secondaryLocations ?? []).map((s) => s.location)].filter(
          (l): l is string => !!l,
        );
        const wp = j.workplaceType?.toLowerCase();
        const comp = parseCompensation(j.compensation?.scrapeableCompensationSalarySummary ?? j.compensation?.compensationTierSummary);
        return {
          nativeId: j.id,
          title: j.title,
          locations: locations.map((raw) => ({ raw })),
          remote: j.isRemote,
          workplace: wp === "remote" || wp === "hybrid" || wp === "onsite" ? wp : undefined,
          employmentType: j.employmentType,
          descriptionHtml: j.descriptionHtml ?? "",
          applyUrl: j.applyUrl ?? j.jobUrl ?? `https://jobs.ashbyhq.com/${source.tenant}/${j.id}`,
          postedAt: toDate(j.publishedAt),
          compensation: comp ? { min: comp.min, max: comp.max, currency: comp.currency, period: comp.period === "unknown" ? undefined : comp.period, raw: comp.raw } : undefined,
          native: j,
        };
      });
    return { notModified: false, postings, etag: res.etag };
  },
};
