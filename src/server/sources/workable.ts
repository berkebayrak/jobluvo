import type { Adapter, RawPosting } from "./types";
import { fetchJson, toDate } from "./types";

interface WorkableJob {
  title: string;
  shortcode: string;
  code?: string;
  employment_type?: string;
  telecommuting?: boolean;
  department?: string;
  url?: string;
  application_url?: string;
  published_on?: string;
  country?: string;
  city?: string;
  state?: string;
  description?: string;
  requirements?: string;
  benefits?: string;
  /** Present on multi location postings; each entry carries its own city, region and country. */
  locations?: { city?: string; region?: string; country?: string; countryCode?: string; workplaceType?: string }[];
}

/**
 * Workable widget API. Semi documented and watched for changes: it is the
 * only Phase 0 feed that is a widget rather than a published board API.
 */
export const workable: Adapter = {
  family: "workable",
  async fetch(source) {
    const url = `https://apply.workable.com/api/v1/widget/accounts/${encodeURIComponent(source.tenant)}?details=true`;
    const res = await fetchJson<{ jobs: WorkableJob[] }>(url, source.etag);
    if (!res) return { notModified: true };
    const postings: RawPosting[] = (res.json.jobs ?? []).map((j) => {
      const extra = (j.locations ?? [])
        .map((l) => [l.city, l.region, l.country].filter(Boolean).join(", "))
        .filter(Boolean);
      const loc = extra.length ? extra : [[j.city, j.state, j.country].filter(Boolean).join(", ")].filter(Boolean);
      const html = [
        j.description,
        j.requirements ? `<h2>Requirements</h2>${j.requirements}` : "",
        j.benefits ? `<h2>Benefits</h2>${j.benefits}` : "",
      ]
        .filter(Boolean)
        .join("\n");
      return {
        nativeId: j.shortcode,
        requisitionId: j.code || undefined,
        title: j.title,
        locations: loc,
        remote: j.telecommuting,
        employmentType: j.employment_type,
        descriptionHtml: html,
        applyUrl: j.application_url ?? j.url ?? `https://apply.workable.com/${source.tenant}/j/${j.shortcode}/apply`,
        postedAt: toDate(j.published_on),
        native: j,
      };
    });
    return { notModified: false, postings, etag: res.etag };
  },
};
