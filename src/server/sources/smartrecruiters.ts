import { sha256 } from "@/server/jobs/normalize";
import type { Adapter, RawPosting } from "./types";
import { fetchJson, toDate } from "./types";

interface SrListItem {
  id: string;
  name: string;
  refNumber?: string;
  releasedDate?: string;
  location?: { city?: string; region?: string; country?: string; remote?: boolean; hybrid?: boolean; fullLocation?: string };
  typeOfEmployment?: { label?: string };
  experienceLevel?: { label?: string };
  ref?: string;
}

interface SrDetail extends SrListItem {
  applyUrl?: string;
  postingUrl?: string;
  jobAd?: { sections?: Record<string, { title?: string; text?: string }> };
}

const SECTION_ORDER = ["companyDescription", "jobDescription", "qualifications", "additionalInformation"];

function locationOf(l: SrListItem["location"]): string[] {
  if (!l) return [];
  const parts = [l.city, l.region, l.country?.toUpperCase()].filter(Boolean);
  const s = l.fullLocation ?? parts.join(", ");
  return s ? [s] : [];
}

/**
 * SmartRecruiters is list plus detail. The published limit is about ten
 * requests a second, eight concurrent, so the adapter hashes each list entry,
 * fetches a body only for entries whose list hash is new or changed, and
 * stops after the detail budget. Entries still waiting are stored with
 * detailPending and picked up next run.
 */
export const smartrecruiters: Adapter = {
  family: "smartrecruiters",
  async fetch(source, opts) {
    const company = encodeURIComponent(source.tenant);
    const items: SrListItem[] = [];
    let offset = 0;
    const limit = 100;
    let etag: string | undefined;
    for (;;) {
      const url = `https://api.smartrecruiters.com/v1/companies/${company}/postings?limit=${limit}&offset=${offset}`;
      const res = await fetchJson<{ totalFound: number; content: SrListItem[] }>(url, offset === 0 ? source.etag : undefined);
      if (!res) return { notModified: true };
      if (offset === 0) etag = res.etag;
      items.push(...res.json.content);
      offset += limit;
      if (offset >= res.json.totalFound || res.json.content.length === 0) break;
    }

    let budget = opts.detailBudget;
    const postings: RawPosting[] = [];
    for (const item of items) {
      const listHash = sha256(JSON.stringify([item.name, item.refNumber, item.releasedDate, item.location, item.typeOfEmployment]));
      const known = opts.known.get(item.id);
      const needsDetail = !known || known.detailPending || known.listHash !== listHash;
      const base: RawPosting = {
        nativeId: item.id,
        requisitionId: item.refNumber,
        title: item.name,
        locations: locationOf(item.location),
        remote: item.location?.remote,
        workplace: item.location?.remote ? "remote" : item.location?.hybrid ? "hybrid" : undefined,
        employmentType: item.typeOfEmployment?.label,
        descriptionHtml: "",
        applyUrl: `https://jobs.smartrecruiters.com/${source.tenant}/${item.id}`,
        postedAt: toDate(item.releasedDate),
        listHash,
        detailPending: needsDetail,
        native: item,
      };
      if (needsDetail && budget > 0) {
        budget -= 1;
        const detailUrl = item.ref ?? `https://api.smartrecruiters.com/v1/companies/${company}/postings/${item.id}`;
        const d = await fetchJson<SrDetail>(detailUrl, undefined);
        if (d) {
          const sections = d.json.jobAd?.sections ?? {};
          const html = SECTION_ORDER.filter((k) => sections[k]?.text)
            .map((k) => `<h2>${sections[k].title ?? ""}</h2>${sections[k].text}`)
            .join("\n");
          base.descriptionHtml = html;
          base.applyUrl = d.json.applyUrl?.replace(/\?oga=true$/, "") ?? d.json.postingUrl ?? base.applyUrl;
          base.detailPending = false;
          base.native = d.json;
        }
      }
      postings.push(base);
    }
    return { notModified: false, postings, etag };
  },
};
