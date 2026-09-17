import type { FeedJob } from "@/server/jobs/feed";

export type { FeedJob };

/** The fields the two cards take, derived from a feed job. */
export interface CardFields {
  company: string;
  logoDomain: string | null;
  title: string;
  location: string;
  salary: string;
  ats: string;
  posted: string;
  /** Absent until scored. */
  match?: number;
  reasons: string[];
}

export const FAMILY_LABEL: Record<string, string> = {
  greenhouse: "Greenhouse",
  lever: "Lever",
  ashby: "Ashby",
  smartrecruiters: "SmartRecruiters",
  workable: "Workable",
  gem: "Gem",
};

const WORKPLACE_LABEL: Record<string, string> = {
  remote: "Remote",
  hybrid: "Hybrid",
  onsite: "On site",
  unknown: "",
};

export function ageOf(iso: string | null, now = Date.now()): string {
  if (!iso) return "";
  const hours = Math.max(0, Math.round((now - new Date(iso).getTime()) / 3_600_000));
  if (hours < 1) return "just now";
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  const days = Math.round(hours / 24);
  if (days < 14) return `${days} day${days === 1 ? "" : "s"} ago`;
  const weeks = Math.round(days / 7);
  return `${weeks} week${weeks === 1 ? "" : "s"} ago`;
}

export function ageHoursOf(iso: string | null, now = Date.now()): number {
  if (!iso) return 9999;
  return (now - new Date(iso).getTime()) / 3_600_000;
}

function money(n: number): string {
  return n >= 1000 ? `${Math.round(n / 1000)}k` : String(n);
}

export function salaryOf(j: FeedJob): string {
  if (j.compMin == null && j.compMax == null) return "Not listed";
  const cur = j.compCurrency ?? "USD";
  const per = j.compPeriod === "hour" ? " an hour" : "";
  if (j.compMin != null && j.compMax != null && j.compMin !== j.compMax) {
    return `${cur} ${money(j.compMin)} to ${money(j.compMax)}${per}`;
  }
  return `${cur} ${money(j.compMin ?? j.compMax ?? 0)}${per}`;
}

export function locationOf(j: FeedJob): string {
  const first = j.locations[0]?.raw ?? "";
  const extra = j.locations.length > 1 ? ` +${j.locations.length - 1}` : "";
  const wp = WORKPLACE_LABEL[j.workplace] ?? "";
  return [first + extra, wp].filter(Boolean).join(". ") || "Location not stated";
}

export function locationLabel(j: FeedJob): string {
  const l = j.locations[0];
  if (!l) return "Not stated";
  if (l.remote && !l.city) return l.country ? `Remote, ${l.country}` : "Remote";
  return [l.city, l.region ?? l.country].filter(Boolean).join(", ") || l.raw;
}

export interface Viewer {
  needsSponsorship: boolean;
  /** False until a confirmed preference fact exists; the feed is unfiltered until then. */
  hasProfile?: boolean;
}

/** The first 120 characters of a sentence, cut at a word, without a leading list dash from the source HTML. */
function short(s: string): string {
  const t = s.trim().replace(/^[-*•·]\s*/, "");
  if (t.length <= 120) return t;
  return t.slice(0, 120).replace(/\s+\S*$/, "") + "…";
}

/**
 * The sponsorship line. A posting is quoted, never read into. Three states
 * for someone who needs sponsorship: the posting says it sponsors, the
 * posting states a restriction and here is the sentence, or the posting says
 * nothing. Quiet is shown as quiet, with a question glyph, not as a yes.
 */
export function sponsorshipLine(j: FeedJob, viewer?: Viewer): string | undefined {
  if (j.eligibility && j.eligibilityEvidence) return `- Posting states a restriction: ${short(j.eligibilityEvidence)}`;
  if (j.sponsorship === "not_offered") return `- Posting states a restriction: ${short(j.sponsorshipEvidence ?? "no sponsorship")}`;
  if (j.sponsorship === "offered") return "+ Posting says it sponsors";
  if (viewer?.needsSponsorship) return "? Posting says nothing about sponsorship";
  return undefined;
}

export function cardFields(j: FeedJob, viewer?: Viewer): CardFields {
  // The score's own lines first, then what the posting says about sponsorship,
  // then where else it is listed. Unknowns carry the question glyph.
  const reasons: string[] = j.match ? [...j.match.reasons, ...j.match.unknowns.map((u) => `? ${u}`)] : [];
  const sp = sponsorshipLine(j, viewer);
  if (sp) reasons.push(sp);
  if (j.alsoOn.length) reasons.push(`Also listed on ${j.alsoOn.map((f) => FAMILY_LABEL[f] ?? f).join(", ")}`);
  return {
    company: j.companyName,
    logoDomain: j.companyDomain,
    title: j.title,
    location: locationOf(j),
    salary: salaryOf(j),
    ats: FAMILY_LABEL[j.family] ?? j.family,
    posted: ageOf(j.postedAt ?? j.firstSeenAt),
    match: j.match?.score,
    reasons,
  };
}
