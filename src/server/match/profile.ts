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

/** The confirmed facts the scorer and the tailor both read, parsed, in a stable order, with the two hashes. */
export interface ResumeFacts {
  userId: string;
  prefs: PreferenceFact;
  employment: EmploymentFact[];
  education: EducationFact[];
  skills: SkillFact[];
  answers: AnswerFact[];
  prefsHash: string;
  factsHash: string;
}

export async function resumeFacts(db: DbHttp | DbPool | Tx, userId: string): Promise<ResumeFacts | null> {
  const rows = await db
    .select({ kind: profileFacts.kind, data: profileFacts.data })
    .from(profileFacts)
    .where(
      and(
        eq(profileFacts.userId, userId),
        eq(profileFacts.status, "confirmed"),
        inArray(profileFacts.kind, ["preference", "employment", "education", "skill", "answer"]),
      ),
    );
  const pref = rows.filter((r) => r.kind === "preference").map((r) => preferenceFact.safeParse(r.data)).find((r) => r.success);
  if (!pref?.success) return null;
  const parse = <T>(kind: string, schema: { safeParse(v: unknown): { success: boolean; data?: T } }): T[] =>
    rows
      .filter((r) => r.kind === kind)
      .map((r) => schema.safeParse(r.data))
      .flatMap((r) => (r.success && r.data !== undefined ? [r.data] : []))
      .sort((a, b) => (canonical(a) < canonical(b) ? -1 : 1));
  const employment = parse<EmploymentFact>("employment", employmentFact).sort((a, b) => (a.start < b.start ? 1 : -1));
  const education = parse<EducationFact>("education", educationFact).sort((a, b) => ((a.end ?? "") < (b.end ?? "") ? 1 : -1));
  const skills = parse<SkillFact>("skill", skillFact);
  const answers = parse<AnswerFact>("answer", answerFact);
  return {
    userId,
    prefs: pref.data,
    employment,
    education,
    skills,
    answers,
    prefsHash: sha256(canonical(pref.data)),
    factsHash: sha256(canonical({ employment, education, skills, answers })),
  };
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
