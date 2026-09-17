import { and, eq, inArray } from "drizzle-orm";
import type { DbHttp, DbPool, Tx } from "@/db/client";
import { profileFacts } from "@/db/schema";
import { sha256 } from "@/server/jobs/normalize";
import {
  answerFact,
  educationFact,
  employmentFact,
  preferenceFact,
  skillFact,
  type AnswerFact,
  type EducationFact,
  type EmploymentFact,
  type PreferenceFact,
  type SkillFact,
} from "@/server/profile/facts";

/*
 * The profile as the scorer reads it: one text block built from the user's
 * confirmed facts, identical for every job scored for that user. It is the
 * stable prefix of every scoring prompt, so its size sets the cached input
 * cost, and its two hashes are what the rework claim compares to decide
 * whether an existing score is still about the current profile.
 *
 * Authorization and sponsorship are not in the block. They are the hard
 * filter's business, settled before a job is ever claimed, and the card
 * quotes the posting's own sentence about them.
 */

export interface ScoringProfile {
  userId: string;
  /** The stable prefix. */
  block: string;
  prefs: PreferenceFact;
  /** Over the preference fact. */
  prefsHash: string;
  /** Over employment, education, skills and answers. */
  factsHash: string;
  counts: { employment: number; education: number; skill: number; answer: number };
}

/** JSON with keys sorted at every level, so the same facts hash the same whatever order they were saved in. */
export function canonical(v: unknown): string {
  if (Array.isArray(v)) return `[${v.map(canonical).join(",")}]`;
  if (v && typeof v === "object") {
    const o = v as Record<string, unknown>;
    return `{${Object.keys(o)
      .sort()
      .filter((k) => o[k] !== undefined)
      .map((k) => `${JSON.stringify(k)}:${canonical(o[k])}`)
      .join(",")}}`;
  }
  return JSON.stringify(v);
}

const span = (start?: string, end?: string) => (start ? `${start} to ${end ?? "present"}` : end ? `to ${end}` : "");

export function renderProfile(p: {
  prefs: PreferenceFact;
  employment: EmploymentFact[];
  education: EducationFact[];
  skills: SkillFact[];
  answers: AnswerFact[];
}): string {
  const out: string[] = ["CANDIDATE PROFILE", ""];
  const pr = p.prefs;
  const prefLines = [
    pr.targetCountries === "any" ? "Open to any country." : `Wants to work in: ${pr.targetCountries.join(", ")}.`,
    pr.relocation === "yes" ? "Will relocate." : `Will not relocate; on site only in ${(pr.onsiteCountries ?? []).join(", ") || "the target countries"}.`,
    pr.remote === "remote_only" ? "Remote roles only." : pr.remote === "no_remote" ? "On site roles only." : "Remote or on site.",
  ];
  if (pr.employmentTypes?.length) prefLines.push(`Employment types: ${pr.employmentTypes.join(", ")}.`);
  if (pr.earliestStart) prefLines.push(`Earliest start ${pr.earliestStart}.`);
  out.push(`Preferences: ${prefLines.join(" ")}`);
  if (p.answers.length) {
    out.push("", "Standing answers:");
    for (const a of p.answers) out.push(`- ${a.question}: ${a.answer}`);
  }
  if (p.employment.length) {
    out.push("", "Experience, most recent first:");
    p.employment.forEach((e, i) => {
      out.push(`${i + 1}. ${e.title}, ${e.company}${e.location ? `, ${e.location}` : ""}, ${span(e.start, e.end)}`);
      for (const b of e.bullets) out.push(`   - ${b}`);
    });
  }
  if (p.education.length) {
    out.push("", "Education:");
    for (const e of p.education) {
      const head = [e.degree, e.field, e.institution].filter(Boolean).join(", ");
      const when = span(e.start, e.end);
      out.push(`- ${head}${when ? `, ${when}` : ""}${e.notes?.length ? `. ${e.notes.join(" ")}` : ""}`);
    }
  }
  if (p.skills.length) {
    out.push("", "Skills:");
    for (const s of p.skills) {
      const detail = [s.years != null ? `${s.years} years` : null, s.evidence].filter(Boolean).join("; ");
      out.push(`- ${s.name}${detail ? ` (${detail})` : ""}`);
    }
  }
  return out.join("\n");
}

/**
 * Where one fact came from: its row, and whether it is the resume's words
 * (upload, with evidence), a line the user typed over them (edit), or a
 * fact the user entered (user). The validator carries this into every
 * claim, so a number the resume supports and a number the user asserted
 * can be told apart on the packet. Not part of the facts hash: the hash is
 * over the facts' content, and the same content from a different row is
 * the same profile.
 */
export interface FactSource {
  rowId: string;
  origin: "upload" | "user" | "edit";
  hasEvidence: boolean;
}

/** The confirmed facts the scorer and the tailor both read, parsed, in a stable order, with the two hashes. */
export interface ResumeFacts {
  userId: string;
  prefs: PreferenceFact;
  employment: EmploymentFact[];
  education: EducationFact[];
  skills: SkillFact[];
  answers: AnswerFact[];
  /** Aligned with employment, education and skills by index. */
  sources: { employment: FactSource[]; education: FactSource[]; skills: FactSource[] };
  prefsHash: string;
  factsHash: string;
}

export interface FactRow {
  id: string;
  kind: string;
  data: unknown;
  origin: "upload" | "user" | "edit";
  evidence: string | null;
}

/**
 * The facts from their rows. Exported on its own so a measurement can
 * rebuild the profile a packet was built on from the rows that were
 * confirmed then, and check it by the hash the packet carries.
 */
export function buildResumeFacts(userId: string, rows: FactRow[]): ResumeFacts | null {
  const pref = rows.filter((r) => r.kind === "preference").map((r) => preferenceFact.safeParse(r.data)).find((r) => r.success);
  if (!pref?.success) return null;
  const parse = <T>(kind: string, schema: { safeParse(v: unknown): { success: boolean; data?: T } }): { data: T; source: FactSource }[] =>
    rows
      .filter((r) => r.kind === kind)
      .map((r) => ({ parsed: schema.safeParse(r.data), source: { rowId: r.id, origin: r.origin, hasEvidence: !!r.evidence } }))
      .flatMap((r) => (r.parsed.success && r.parsed.data !== undefined ? [{ data: r.parsed.data, source: r.source }] : []))
      .sort((a, b) => (canonical(a.data) < canonical(b.data) ? -1 : 1));
  const employment = parse<EmploymentFact>("employment", employmentFact).sort((a, b) => (a.data.start < b.data.start ? 1 : -1));
  const education = parse<EducationFact>("education", educationFact).sort((a, b) => ((a.data.end ?? "") < (b.data.end ?? "") ? 1 : -1));
  const skills = parse<SkillFact>("skill", skillFact);
  const answers = parse<AnswerFact>("answer", answerFact).map((a) => a.data);
  const facts = { employment: employment.map((e) => e.data), education: education.map((e) => e.data), skills: skills.map((s) => s.data), answers };
  return {
    userId,
    prefs: pref.data,
    ...facts,
    sources: { employment: employment.map((e) => e.source), education: education.map((e) => e.source), skills: skills.map((s) => s.source) },
    prefsHash: sha256(canonical(pref.data)),
    factsHash: sha256(canonical(facts)),
  };
}

export async function resumeFacts(db: DbHttp | DbPool | Tx, userId: string): Promise<ResumeFacts | null> {
  const rows = await db
    .select({ id: profileFacts.id, kind: profileFacts.kind, data: profileFacts.data, origin: profileFacts.origin, evidence: profileFacts.evidence })
    .from(profileFacts)
    .where(
      and(
        eq(profileFacts.userId, userId),
        eq(profileFacts.status, "confirmed"),
        inArray(profileFacts.kind, ["preference", "employment", "education", "skill", "answer"]),
      ),
    );
  return buildResumeFacts(userId, rows);
}

export async function scoringProfile(db: DbHttp | DbPool | Tx, userId: string): Promise<ScoringProfile | null> {
  const f = await resumeFacts(db, userId);
  if (!f) return null;
  return {
    userId,
    block: renderProfile(f),
    prefs: f.prefs,
    prefsHash: f.prefsHash,
    factsHash: f.factsHash,
    counts: { employment: f.employment.length, education: f.education.length, skill: f.skills.length, answer: f.answers.length },
  };
}
