import type { Adapter, RawPosting } from "./types";
import { fetchJson, toDate } from "./types";

interface GhJob {
  id: number;
  title: string;
  absolute_url: string;
  requisition_id?: string | null;
  location?: { name?: string };
  offices?: { name?: string; location?: string | null }[];
  first_published?: string;
  updated_at?: string;
  content?: string;
  metadata?: { name?: string; value?: unknown }[];
}

/**
 * Greenhouse job board API. One request per board with content=true; the
 * body is HTML with its entities escaped once more, which htmlToText undoes.
 */
export const greenhouse: Adapter = {
  family: "greenhouse",
  async fetch(source) {
    const url = `https://boards-api.greenhouse.io/v1/boards/${encodeURIComponent(source.tenant)}/jobs?content=true`;
    const res = await fetchJson<{ jobs: GhJob[] }>(url, source.etag);
    if (!res) return { notModified: true };
    const postings: RawPosting[] = res.json.jobs.map((j) => {
      const locations = new Set<string>();
      if (j.location?.name) locations.add(j.location.name);
      for (const o of j.offices ?? []) if (o.location) locations.add(o.location);
      const employment = j.metadata?.find((m) => /employment type/i.test(m.name ?? ""))?.value;
      return {
        nativeId: String(j.id),
        requisitionId: j.requisition_id ?? undefined,
        title: j.title,
        locations: [...locations].map((raw) => ({ raw })),
        employmentType: typeof employment === "string" ? employment : undefined,
        descriptionHtml: j.content ?? "",
        applyUrl: j.absolute_url,
        postedAt: toDate(j.first_published) ?? toDate(j.updated_at),
        native: j,
      };
    });
    return { notModified: false, postings, etag: res.etag };
  },
};
