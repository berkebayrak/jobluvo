import type { Family } from "@/db/schema";
import { normalise } from "@/server/jobs/normalize";
import { ADAPTERS } from "@/server/sources/registry";

/**
 * Fetches one board through its adapter without touching the database and
 * prints what the normaliser makes of it. `npm run probe -- workable zego`.
 */
async function main() {
  const [family, tenant] = process.argv.slice(2) as [Family, string];
  const adapter = ADAPTERS[family];
  if (!adapter || !tenant) {
    console.error("usage: npm run probe -- <family> <tenant>");
    process.exit(2);
  }
  const source = {
    id: "probe",
    family,
    tenant,
    companyName: tenant,
    companyDomain: null,
    active: true,
    etag: null,
    lastPolledAt: null,
    lastStatus: null,
    lastError: null,
    consecutiveFailures: 0,
    jobCount: 0,
    boilerplateVersion: 0,
    boilerplate: [],
    createdAt: new Date(),
  };
  const r = await adapter.fetch(source, { detailBudget: 5, known: new Map() });
  if (r.notModified) {
    console.log("not modified");
    return;
  }
  console.log(`${r.postings.length} postings, etag ${r.etag ?? "none"}`);
  const ids = new Map<string, number>();
  for (const p of r.postings) ids.set(p.nativeId, (ids.get(p.nativeId) ?? 0) + 1);
  const dupes = [...ids].filter(([, n]) => n > 1);
  if (dupes.length) console.log("duplicate native ids:", dupes);
  for (const p of r.postings.slice(0, 3)) {
    const n = normalise(p, []);
    console.log({
      nativeId: p.nativeId,
      title: n.title,
      locations: n.locations,
      workplace: n.workplace,
      employment: n.employmentType,
      comp: n.comp,
      seniority: n.seniority,
      sponsorship: n.sponsorship,
      applyUrl: p.applyUrl,
      postedAt: p.postedAt,
      textChars: n.descriptionText.length,
      coreChars: n.descriptionCore.length,
    });
  }
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
