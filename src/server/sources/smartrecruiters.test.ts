import { afterEach, describe, expect, it, vi } from "vitest";
import type { Source } from "@/db/schema";
import { sha256 } from "@/server/jobs/normalize";
import { smartrecruiters } from "./smartrecruiters";

const source = { tenant: "acme", etag: '"list-v1"' } as unknown as Source;

const list = {
  totalFound: 1,
  content: [
    {
      id: "j1",
      name: "Engineer",
      releasedDate: "2026-09-01T00:00:00.000Z",
      location: { city: "Paris", region: "IDF", country: "fr", remote: false, fullLocation: "Paris, IDF, France" },
    },
  ],
};
const detail = { id: "j1", name: "Engineer", applyUrl: "https://jobs.smartrecruiters.com/acme/j1", jobAd: { sections: { jobDescription: { title: "Role", text: "<p>Build things</p>" } } } };

/** Records the If-None-Match header of every list request and serves a 304 whenever one is sent. */
function stubFetch() {
  const listHeaders: (string | null)[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init?: RequestInit) => {
      const headers = new Headers(init?.headers);
      if (url.includes("/postings?")) {
        listHeaders.push(headers.get("if-none-match"));
        if (headers.get("if-none-match")) return new Response(null, { status: 304 });
        return Response.json(list, { headers: { etag: '"list-v1"' } });
      }
      return Response.json(detail);
    }),
  );
  return listHeaders;
}

afterEach(() => vi.unstubAllGlobals());

describe("smartrecruiters detail drain", () => {
  it("sends the etag when nothing is pending, so an unchanged list costs one request", async () => {
    const listHeaders = stubFetch();
    const r = await smartrecruiters.fetch(source, { detailBudget: 40, known: new Map([["j1", { listHash: "x", detailPending: false, hasBody: true }]]) });
    expect(listHeaders).toEqual(['"list-v1"']);
    expect(r.notModified).toBe(true);
  });

  it("skips the conditional request while a known job is pending, so the backlog drains", async () => {
    const listHeaders = stubFetch();
    const r = await smartrecruiters.fetch(source, { detailBudget: 40, known: new Map([["j1", { listHash: "x", detailPending: true, hasBody: false }]]) });
    expect(listHeaders).toEqual([null]);
    expect(r.notModified).toBe(false);
    if (r.notModified) return;
    expect(r.postings).toHaveLength(1);
    expect(r.postings[0].detail).toBe("fetched");
    expect(r.postings[0].locations).toEqual([{ raw: "Paris, IDF, France", city: "Paris", region: "IDF", countryCode: "FR", remote: undefined }]);
    expect(r.postings[0].descriptionHtml).toContain("Build things");
    expect(r.etag).toBe('"list-v1"');
  });
});

describe("smartrecruiters list paging", () => {
  it("collects every record when a middle page comes back short", async () => {
    // Five postings the board serves as pages of 2, 2 and 1, whatever limit was asked for.
    const pages: Record<string, string[]> = { "0": ["a", "b"], "2": ["c", "d"], "4": ["e"] };
    const offsets: string[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        if (url.includes("/postings?")) {
          const offset = new URL(url).searchParams.get("offset") ?? "0";
          offsets.push(offset);
          const ids = pages[offset] ?? [];
          return Response.json({ totalFound: 5, content: ids.map((id) => ({ id, name: `Job ${id}` })) });
        }
        const id = url.split("/").pop();
        return Response.json({ id, name: `Job ${id}`, jobAd: { sections: { jobDescription: { text: "<p>Body</p>" } } } });
      }),
    );
    const r = await smartrecruiters.fetch({ tenant: "acme", etag: null } as unknown as Source, { detailBudget: 40, known: new Map() });
    expect(r.notModified).toBe(false);
    if (r.notModified) return;
    expect(offsets).toEqual(["0", "2", "4"]);
    expect(r.postings.map((p) => p.nativeId)).toEqual(["a", "b", "c", "d", "e"]);
    expect(r.postings.every((p) => p.detail === "fetched")).toBe(true);
  });
});

describe("smartrecruiters detail states over successive polls", () => {
  const two = { totalFound: 2, content: [{ id: "a", name: "A" }, { id: "b", name: "B" }] };
  function stub(listBody: unknown) {
    const detailUrls: string[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        if (url.includes("/postings?")) return Response.json(listBody);
        detailUrls.push(url);
        const id = url.split("/").pop();
        return Response.json({ id, name: id, jobAd: { sections: { jobDescription: { text: `<p>Body ${id}</p>` } } } });
      }),
    );
    return detailUrls;
  }
  const hashOf = (name: string) => sha256(JSON.stringify([name, undefined, undefined, undefined, undefined]));

  it("poll 1 fetches within budget and marks the rest pending; poll 2 reports the unchanged one as stored and fetches the pending one", async () => {
    let urls = stub(two);
    const p1 = await smartrecruiters.fetch({ tenant: "acme", etag: null } as unknown as Source, { detailBudget: 1, known: new Map() });
    expect(p1.notModified).toBe(false);
    if (p1.notModified) return;
    expect(p1.postings.map((p) => [p.nativeId, p.detail])).toEqual([
      ["a", "fetched"],
      ["b", "pending"],
    ]);
    expect(p1.postings[0].descriptionHtml).toContain("Body a");
    expect(p1.postings[1].descriptionHtml).toBe("");
    expect(urls).toHaveLength(1);

    // What ingest stored after poll 1: a has its body, b is pending.
    const known = new Map([
      ["a", { listHash: hashOf("A"), detailPending: false, hasBody: true }],
      ["b", { listHash: hashOf("B"), detailPending: true, hasBody: false }],
    ]);
    urls = stub(two);
    const p2 = await smartrecruiters.fetch({ tenant: "acme", etag: '"v1"' } as unknown as Source, { detailBudget: 40, known });
    expect(p2.notModified).toBe(false);
    if (p2.notModified) return;
    expect(p2.postings.map((p) => [p.nativeId, p.detail])).toEqual([
      ["a", "stored"],
      ["b", "fetched"],
    ]);
    // The stored one carries no body, and nothing may overwrite the stored one with it.
    expect(p2.postings[0].descriptionHtml).toBe("");
    expect(urls).toEqual([expect.stringContaining("/postings/b")]);
  });

  it("a changed listing over budget is reported pending, not stored, so the next poll drains it even after a 304", async () => {
    stub({ totalFound: 2, content: [{ id: "a", name: "A renamed" }, { id: "b", name: "B" }] });
    const known = new Map([
      ["a", { listHash: hashOf("A"), detailPending: false, hasBody: true }],
      ["b", { listHash: hashOf("B"), detailPending: false, hasBody: true }],
    ]);
    const r = await smartrecruiters.fetch({ tenant: "acme", etag: null } as unknown as Source, { detailBudget: 0, known });
    expect(r.notModified).toBe(false);
    if (r.notModified) return;
    expect(r.postings.map((p) => [p.nativeId, p.detail])).toEqual([
      ["a", "pending"],
      ["b", "stored"],
    ]);
  });
});

describe("smartrecruiters stored body check", () => {
  it("fetches a detail again for a row that is not pending and unchanged but has no body stored", async () => {
    const urls: string[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        if (url.includes("/postings?")) return Response.json({ totalFound: 1, content: [{ id: "a", name: "A" }] });
        urls.push(url);
        return Response.json({ id: "a", name: "A", jobAd: { sections: { jobDescription: { text: "<p>Body a</p>" } } } });
      }),
    );
    const hash = sha256(JSON.stringify(["A", undefined, undefined, undefined, undefined]));
    const known = new Map([["a", { listHash: hash, detailPending: false, hasBody: false }]]);
    const r = await smartrecruiters.fetch({ tenant: "acme", etag: null } as unknown as Source, { detailBudget: 40, known });
    expect(r.notModified).toBe(false);
    if (r.notModified) return;
    expect(r.postings[0].detail).toBe("fetched");
    expect(r.postings[0].descriptionHtml).toContain("Body a");
    expect(urls).toHaveLength(1);
  });
});
