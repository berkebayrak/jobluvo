import type { Adapter, RawPosting } from "./types";
import { fetchJson, toDate } from "./types";

interface LeverPosting {
  id: string;
  text: string;
  hostedUrl?: string;
  applyUrl?: string;
  createdAt?: number;
  country?: string;
  workplaceType?: string;
  categories?: { location?: string; allLocations?: string[]; commitment?: string; team?: string };
  opening?: string;
  description?: string;
  descriptionBody?: string;
  lists?: { text: string; content: string }[];
  additional?: string;
  salaryRange?: { min?: number; max?: number; currency?: string; interval?: string };
}

/**
 * Lever postings API. The body is spread over opening, description, lists and
 * additional; they are concatenated in that order so the text reads as the
 * hosted page does. The equal opportunity paragraph in `additional` repeats
 * across a board and is caught by boilerplate detection.
 */
export const lever: Adapter = {
  family: "lever",
  async fetch(source) {
    const url = `https://api.lever.co/v0/postings/${encodeURIComponent(source.tenant)}?mode=json`;
    const res = await fetchJson<LeverPosting[]>(url, source.etag);
    if (!res) return { notModified: true };
    const postings: RawPosting[] = res.json.map((p) => {
      const lists = (p.lists ?? []).map((l) => `<h3>${l.text}</h3><ul>${l.content}</ul>`).join("");
      const html = [p.opening, p.descriptionBody ?? p.description, lists, p.additional].filter(Boolean).join("\n");
      const locations = p.categories?.allLocations?.length
        ? p.categories.allLocations
        : p.categories?.location
          ? [p.categories.location]
          : [];
      const wp = p.workplaceType?.toLowerCase();
      const workplace = wp === "remote" || wp === "hybrid" ? wp : wp === "onsite" || wp === "on-site" ? "onsite" : undefined;
      const sr = p.salaryRange;
      return {
        nativeId: p.id,
        title: p.text,
        locations,
        workplace,
        employmentType: p.categories?.commitment,
        descriptionHtml: html,
        applyUrl: p.applyUrl ?? p.hostedUrl ?? `https://jobs.lever.co/${source.tenant}/${p.id}/apply`,
        postedAt: toDate(p.createdAt),
        compensation: sr?.min || sr?.max
          ? { min: sr.min, max: sr.max, currency: sr.currency, period: /hour/i.test(sr.interval ?? "") ? "hour" : "year" }
          : undefined,
        native: p,
      };
    });
    return { notModified: false, postings, etag: res.etag };
  },
};
