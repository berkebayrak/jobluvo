import type { ResumeChange, ResumeDocument } from "@/db/schema";
import { sha256 } from "@/server/jobs/normalize";
import type { ResumeFacts } from "@/server/match/profile";

/*
 * The resume as a document built from confirmed facts, and the edits the
 * tailor may make to it. Every line carries the id of the fact it came
 * from: roles R1, R2 most recent first, bullets R1.1, R1.2, education E1,
 * skills S1, answers A1. The model edits by id and cites by id, the code
 * applies the edits, and the diff is the change set itself (DOC-03), not a
 * comparison of two long strings afterwards.
 */

export interface FactEntry {
  id: string;
  text: string;
}

const span = (start?: string, end?: string) => (start ? `${start} to ${end ?? "present"}` : end ? `to ${end}` : "");

/** Every confirmed fact as one line of text with its id, the set the validator and the prompt both read. */
export function factEntries(f: ResumeFacts): FactEntry[] {
  const out: FactEntry[] = [];
  f.employment.forEach((e, i) => {
    const rid = `R${i + 1}`;
    out.push({ id: rid, text: `${e.title}, ${e.company}${e.location ? `, ${e.location}` : ""}, ${span(e.start, e.end)}` });
    e.bullets.forEach((b, j) => out.push({ id: `${rid}.${j + 1}`, text: b }));
  });
  f.education.forEach((e, i) => {
    const head = [e.degree, e.field, e.institution].filter(Boolean).join(", ");
    const when = span(e.start, e.end);
    out.push({ id: `E${i + 1}`, text: `${head}${when ? `, ${when}` : ""}${e.notes?.length ? `. ${e.notes.join(" ")}` : ""}` });
  });
  f.skills.forEach((s, i) => {
    const detail = [s.years != null ? `${s.years} years` : null, s.evidence].filter(Boolean).join("; ");
    out.push({ id: `S${i + 1}`, text: `${s.name}${detail ? ` (${detail})` : ""}` });
  });
  f.answers.forEach((a, i) => out.push({ id: `A${i + 1}`, text: `${a.question}: ${a.answer}` }));
  return out;
}

/** The untailored document: the facts in their own order and words. */
export function baseResume(f: ResumeFacts): ResumeDocument {
  const entries = new Map(factEntries(f).map((e) => [e.id, e.text]));
  return {
    summary: null,
    experience: f.employment.map((e, i) => {
      const rid = `R${i + 1}`;
      return { id: rid, heading: entries.get(rid)!, bullets: e.bullets.map((b, j) => ({ id: `${rid}.${j + 1}`, text: b })) };
    }),
    education: f.education.map((_, i) => ({ id: `E${i + 1}`, text: entries.get(`E${i + 1}`)! })),
    skills: f.skills.map((s, i) => ({ id: `S${i + 1}`, text: s.name })),
  };
}

export interface ChangeSet {
  /** A line for the top of the resume, or null for none. */
  summary: string | null;
  changes: ResumeChange[];
  /** Skill ids to list first, in this order; the rest follow in their own order. */
  skills: string[];
}

export interface DiffLine {
  bullet: string;
  before: string;
  after: string;
  facts: string[];
}

export interface Applied {
  resume: ResumeDocument;
  diff: DiffLine[];
  /** Changes that named a bullet the resume does not have; dropped, and reported as soft findings by the validator. */
  dropped: ResumeChange[];
}

/** Applies a change set to the base document. Pure; the validator has already decided whether it may be shown. */
export function applyChanges(base: ResumeDocument, cs: ChangeSet): Applied {
  const resume: ResumeDocument = structuredClone(base);
  const diff: DiffLine[] = [];
  const dropped: ResumeChange[] = [];
  const byId = new Map<string, { text: string }>();
  for (const role of resume.experience) for (const b of role.bullets) byId.set(b.id, b);
  for (const c of cs.changes) {
    const b = byId.get(c.bullet);
    if (!b) {
      dropped.push(c);
      continue;
    }
    if (b.text !== c.text) diff.push({ bullet: c.bullet, before: b.text, after: c.text, facts: c.facts });
    b.text = c.text;
  }
  if (cs.summary) {
    resume.summary = cs.summary;
    diff.unshift({ bullet: "summary", before: "", after: cs.summary, facts: [] });
  }
  if (cs.skills.length) {
    const known = new Set(resume.skills.map((s) => s.id));
    const first = cs.skills.filter((id, i, xs) => known.has(id) && xs.indexOf(id) === i);
    const rest = resume.skills.filter((s) => !first.includes(s.id));
    resume.skills = [...first.map((id) => resume.skills.find((s) => s.id === id)!), ...rest];
  }
  return { resume, diff, dropped };
}

/** The whole document mode: the model returned every bullet of every role. Reconciled onto the base by role id and position. */
export function applyDocument(base: ResumeDocument, doc: { summary: string | null; experience: { id: string; bullets: string[] }[]; skills: string[] }): Applied {
  const cs: ChangeSet = { summary: doc.summary, changes: [], skills: [] };
  for (const role of doc.experience) {
    const baseRole = base.experience.find((r) => r.id === role.id);
    if (!baseRole) continue;
    role.bullets.forEach((text, j) => {
      const id = `${role.id}.${j + 1}`;
      if (baseRole.bullets[j]) cs.changes.push({ bullet: id, text, facts: [] });
    });
  }
  const byName = new Map(base.skills.map((s) => [s.text.toLowerCase(), s.id]));
  cs.skills = doc.skills.map((n) => byName.get(n.toLowerCase())).filter((id): id is string => !!id);
  return applyChanges(base, cs);
}

export function renderResume(name: string, doc: ResumeDocument): string {
  const out: string[] = [name, ""];
  if (doc.summary) out.push(doc.summary, "");
  out.push("Experience");
  for (const r of doc.experience) {
    out.push(r.heading);
    for (const b of r.bullets) out.push(`- ${b.text}`);
    out.push("");
  }
  if (doc.education.length) {
    out.push("Education");
    for (const e of doc.education) out.push(`- ${e.text}`);
    out.push("");
  }
  if (doc.skills.length) out.push("Skills", doc.skills.map((s) => s.text).join(", "));
  return out.join("\n").trimEnd();
}

export function resumeHash(doc: ResumeDocument): string {
  return sha256(JSON.stringify(doc));
}
