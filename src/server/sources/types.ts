import type { Family, Source } from "@/db/schema";

/**
 * What an adapter hands the normaliser for one posting. Native JSON is kept
 * whole in `native`; the named fields are the ones every family can supply in
 * some form. Anything the family does not expose is left undefined and
 * becomes "unknown" downstream, never guessed.
 */
export interface RawPosting {
  nativeId: string;
  requisitionId?: string;
  title: string;
  /** Location strings as the platform gives them, one per location. */
  locations: string[];
  /** Set only when the platform states it. */
  remote?: boolean;
  workplace?: "remote" | "hybrid" | "onsite";
  employmentType?: string;
  descriptionHtml: string;
  applyUrl: string;
  postedAt?: Date;
  compensation?: { min?: number; max?: number; currency?: string; period?: "year" | "hour" };
  /** SmartRecruiters: the body has not been fetched yet for this list entry. */
  detailPending?: boolean;
  /** SmartRecruiters: hash of the list entry, so a detail is refetched only on change. */
  listHash?: string;
  native: unknown;
}

export type FetchResult =
  | { notModified: true }
  | { notModified: false; postings: RawPosting[]; etag?: string };

export interface Adapter {
  family: Family;
  /**
   * Fetches the board. Sends If-None-Match with the stored etag and answers
   * notModified on a 304, so a quiet board costs one request and no parsing.
   * Throws on a non 2xx, non 304 response; the caller records the failure.
   */
  fetch(source: Source, opts: FetchOptions): Promise<FetchResult>;
}

export interface FetchOptions {
  /** Upper bound on detail requests in this run, for list plus detail families. */
  detailBudget: number;
  /** Jobs already stored for this source, keyed by native id, with their list hash. */
  known: Map<string, { listHash: string | null; detailPending: boolean }>;
}

export const USER_AGENT = "Jobluvo/0.1 (+https://jobluvo.vercel.app)";

export class FetchError extends Error {
  constructor(
    public readonly status: number,
    public readonly url: string,
  ) {
    super(`HTTP ${status} from ${url}`);
  }
}

/**
 * One request with the shared headers and a conditional If-None-Match.
 * Returns the parsed JSON and the new etag, or `null` on a 304.
 */
export async function fetchJson<T>(
  url: string,
  etag: string | null | undefined,
): Promise<{ json: T; etag?: string } | null> {
  const headers: Record<string, string> = {
    Accept: "application/json",
    "User-Agent": USER_AGENT,
  };
  if (etag) headers["If-None-Match"] = etag;
  const res = await fetch(url, { headers, cache: "no-store", signal: AbortSignal.timeout(25_000) });
  if (res.status === 304) return null;
  if (!res.ok) throw new FetchError(res.status, url);
  const json = (await res.json()) as T;
  const newEtag = res.headers.get("etag") ?? undefined;
  return { json, etag: newEtag };
}

export function toDate(v: unknown): Date | undefined {
  if (v == null) return undefined;
  if (typeof v === "number") return new Date(v < 1e12 ? v * 1000 : v);
  if (typeof v === "string") {
    const d = new Date(v);
    return Number.isNaN(d.getTime()) ? undefined : d;
  }
  return undefined;
}
