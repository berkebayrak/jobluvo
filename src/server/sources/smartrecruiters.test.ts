import { afterEach, describe, expect, it, vi } from "vitest";
import type { Source } from "@/db/schema";
import { smartrecruiters } from "./smartrecruiters";

const source = { tenant: "acme", etag: '"list-v1"' } as unknown as Source;

const list = { totalFound: 1, content: [{ id: "j1", name: "Engineer", releasedDate: "2026-09-01T00:00:00.000Z" }] };
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
    const r = await smartrecruiters.fetch(source, { detailBudget: 40, known: new Map([["j1", { listHash: "x", detailPending: false }]]) });
    expect(listHeaders).toEqual(['"list-v1"']);
    expect(r.notModified).toBe(true);
  });

  it("skips the conditional request while a known job is pending, so the backlog drains", async () => {
    const listHeaders = stubFetch();
    const r = await smartrecruiters.fetch(source, { detailBudget: 40, known: new Map([["j1", { listHash: "x", detailPending: true }]]) });
    expect(listHeaders).toEqual([null]);
    expect(r.notModified).toBe(false);
    if (r.notModified) return;
    expect(r.postings).toHaveLength(1);
    expect(r.postings[0].detailPending).toBe(false);
    expect(r.postings[0].descriptionHtml).toContain("Build things");
    expect(r.etag).toBe('"list-v1"');
  });
});
