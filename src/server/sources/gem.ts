import type { Adapter, RawPosting } from "./types";
import { fetchJson, toDate } from "./types";

interface GemPost {
  id: string;
  title: string;
  absolute_url?: string;
  content?: string;
  employment_type?: string;
  location_type?: string;
  location?: { name?: string };
  offices?: { location?: { name?: string } }[];
  requisition_id?: string;
  first_published_at?: string;
  created_at?: string;
}

/** Gem job board API. The shape mirrors Greenhouse's, which Gem borrowed. */
export const gem: Adapter = {
  family: "gem",
  async fetch(source) {
    const url = `https://api.gem.com/job_board/v0/${encodeURIComponent(source.tenant)}/job_posts/`;
    const res = await fetchJson<GemPost[] | { job_posts: GemPost[] }>(url, source.etag);
    if (!res) return { notModified: true };
    const list = Array.isArray(res.json) ? res.json : res.json.job_posts ?? [];
    const postings: RawPosting[] = list.map((j) => {
      const locations = new Set<string>();
      if (j.location?.name) locations.add(j.location.name);
      for (const o of j.offices ?? []) if (o.location?.name) locations.add(o.location.name);
      const lt = j.location_type?.toLowerCase();
      return {
        nativeId: String(j.id),
        requisitionId: j.requisition_id,
        title: j.title,
        locations: [...locations],
        workplace: lt === "remote" || lt === "hybrid" ? lt : lt === "onsite" || lt === "on_site" ? "onsite" : undefined,
        employmentType: j.employment_type,
        descriptionHtml: j.content ?? "",
        applyUrl: j.absolute_url ?? `https://jobs.gem.com/${source.tenant}/${j.id}`,
        postedAt: toDate(j.first_published_at) ?? toDate(j.created_at),
        native: j,
      };
    });
    return { notModified: false, postings, etag: res.etag };
  },
};
