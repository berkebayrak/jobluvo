"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/core/Button";
import { Input } from "@/components/core/Input";
import { Card } from "@/components/data/Card";
import { showToast } from "@/components/feedback/Toaster";

const AUTH = [
  ["Authorized to work in US", "No, requires visa sponsorship"],
  ["Current status", "Outside the US"],
  ["Will need sponsorship", "Yes, now and in future"],
  ["Earliest start", "1 November 2026"],
  ["Willing to relocate", "Yes, US wide"],
];

const TARGETS = [
  "Strategy manager",
  "Director of strategy",
  "Product manager",
  "Transformation lead",
  "US remote",
  "New York",
  "San Francisco",
];

/** The delivered mock rows, shown until the profile has confirmed facts of its own. */
const EXPERIENCE: [string, string, string][] = [
  [
    "2022 to now",
    "Head of Strategy and PMO, Arvento",
    "Led a 3 year cost program across 4 business units.",
  ],
  [
    "2019 to 2022",
    "Senior Strategy Consultant, Deloitte Turkey",
    "Growth and operating model projects.",
  ],
  ["2016 to 2019", "Business Analyst, Turkcell", "Pricing and market analysis."],
];

const ANSWERS: [string, string, boolean?][] = [
  ["Salary expectation", "USD 150,000 to 175,000 base"],
  ["Notice period", "30 days"],
  ["Security clearance", "Not set. Applications asking this will wait for you.", true],
];

const RESUMES: [string, string, boolean][] = [
  ["Strategy v3", "Default. Updated 8 Sep", true],
  ["PM v2", "Updated 2 Sep", true],
  ["Original upload", "PDF, 11 Aug", false],
];

interface Fact {
  id: string;
  documentId: string | null;
  kind: string;
  data: Record<string, unknown>;
  evidence: string | null;
  origin: string;
  status: string;
  /** Moves on every edit. A decision names the version it saw, and holds only for that version. */
  version: number;
}

/** The fields of each kind, as the review form shows and edits them. "lines" is one entry per line. */
type FieldSpec = { key: string; label: string; type: "text" | "lines" | "number"; hint?: string };
const FIELDS: Record<string, FieldSpec[]> = {
  employment: [
    { key: "title", label: "Title", type: "text" },
    { key: "company", label: "Company", type: "text" },
    { key: "location", label: "Location", type: "text" },
    { key: "start", label: "Start", type: "text", hint: "YYYY-MM" },
    { key: "end", label: "End", type: "text", hint: "YYYY-MM, or empty for a current role" },
    { key: "bullets", label: "Lines", type: "lines", hint: "One line per bullet, as it should read on your resume" },
  ],
  education: [
    { key: "degree", label: "Degree", type: "text" },
    { key: "field", label: "Field", type: "text" },
    { key: "institution", label: "Institution", type: "text" },
    { key: "start", label: "Start", type: "text", hint: "YYYY-MM" },
    { key: "end", label: "End", type: "text", hint: "YYYY-MM" },
    { key: "notes", label: "Notes", type: "lines", hint: "One per line" },
  ],
  skill: [
    { key: "name", label: "Skill", type: "text" },
    { key: "years", label: "Years", type: "number" },
    { key: "evidence", label: "Where the resume shows it", type: "text", hint: "The scorer and the tailored resume read this line" },
  ],
  answer: [
    { key: "question", label: "Question", type: "text" },
    { key: "answer", label: "Answer", type: "text" },
  ],
  contact: [
    { key: "name", label: "Name", type: "text" },
    { key: "email", label: "Email", type: "text" },
    { key: "location", label: "Location", type: "text" },
  ],
  link: [{ key: "url", label: "URL", type: "text" }],
  project: [
    { key: "name", label: "Project", type: "text" },
    { key: "notes", label: "Lines", type: "lines", hint: "One per line" },
  ],
};

/** The form's text for a field value, and back. */
const toText = (v: unknown, type: FieldSpec["type"]) => (type === "lines" ? (Array.isArray(v) ? v.join("\n") : "") : v == null ? "" : String(v));
function fromText(text: string, type: FieldSpec["type"]): unknown {
  const t = text.trim();
  if (type === "lines")
    return t
      .split("\n")
      .map((l) => l.replace(/^[-•]\s*/, "").trim())
      .filter(Boolean);
  if (type === "number") return t === "" ? undefined : Number(t);
  return t === "" ? undefined : t;
}

/**
 * Every value of a waiting fact, so nothing is confirmed unseen: a role
 * shows each of its lines, not a count of them. Confirmed facts keep the
 * delivered one line row.
 */
function FactDetail({ f }: { f: Fact }) {
  const d = f.data as Record<string, unknown>;
  const s = (k: string) => (d[k] == null ? "" : String(d[k]));
  const lines = (k: string) => (Array.isArray(d[k]) ? (d[k] as string[]) : []);
  if (f.kind === "employment") {
    return (
      <>
        <b style={{ fontWeight: 500 }}>
          {s("title")}, {s("company")}
        </b>
        <div className="sub">
          {month(d.start)} to {d.end ? month(d.end) : "now"}
          {s("location") ? `. ${s("location")}` : ""}
        </div>
        <ul style={{ margin: "6px 0 0", paddingLeft: 18 }}>
          {lines("bullets").map((b, i) => (
            <li key={i}>{b}</li>
          ))}
        </ul>
      </>
    );
  }
  if (f.kind === "education") {
    return (
      <>
        <b style={{ fontWeight: 500 }}>
          {s("degree")}
          {s("field") ? `, ${s("field")}` : ""}
        </b>
        <div className="sub">
          {s("institution")}
          {d.start || d.end ? `. ${month(d.start)}${d.end ? ` to ${month(d.end)}` : ""}` : ""}
        </div>
        {lines("notes").length ? (
          <ul style={{ margin: "6px 0 0", paddingLeft: 18 }}>
            {lines("notes").map((n, i) => (
              <li key={i}>{n}</li>
            ))}
          </ul>
        ) : null}
      </>
    );
  }
  return <>{factRow(f, 0).value}</>;
}

/** The inline edit of one waiting fact. Save posts the whole fact at the version the page showed. */
function EditForm({ f, busy, onSave, onCancel }: { f: Fact; busy: boolean; onSave: (data: Record<string, unknown>) => void; onCancel: () => void }) {
  const spec = FIELDS[f.kind] ?? [];
  const [values, setValues] = useState<Record<string, string>>(() => Object.fromEntries(spec.map((x) => [x.key, toText(f.data[x.key], x.type)])));
  const data = () => Object.fromEntries(spec.map((x) => [x.key, fromText(values[x.key] ?? "", x.type)]).filter(([, v]) => v !== undefined));
  return (
    <div style={{ display: "grid", gap: 8 }}>
      {spec.map((x) =>
        x.type === "lines" ? (
          <label key={x.key} style={{ display: "grid", gap: 4 }}>
            <span className="sub">{x.label}</span>
            <textarea className="textarea" rows={Math.max(3, (values[x.key] ?? "").split("\n").length)} value={values[x.key] ?? ""} onChange={(e) => setValues({ ...values, [x.key]: e.target.value })} />
            {x.hint ? <span className="sub">{x.hint}</span> : null}
          </label>
        ) : (
          <Input key={x.key} label={x.label} hint={x.hint} value={values[x.key] ?? ""} onChange={(e) => setValues({ ...values, [x.key]: e.target.value })} />
        ),
      )}
      <div className="row" style={{ gap: 6, justifyContent: "flex-end" }}>
        <Button size="sm" variant="ghost" disabled={busy} onClick={onCancel}>
          Cancel
        </Button>
        <Button size="sm" disabled={busy} onClick={() => onSave(data())}>
          Save
        </Button>
      </div>
    </div>
  );
}

interface Doc {
  id: string;
  filename: string;
  uploadedAt: string;
  status: "processing" | "ready" | "failed";
  state: "processing" | "failed" | "check" | "verified" | "rejected" | "empty";
  error: string | null;
  issues: string[];
  extracted: number;
  confirmed: number;
  rejected: number;
}

/** The tag on a document row. One word per state; a failed or empty document is never "Verified". */
const DOC_TAG: Record<Doc["state"], string> = {
  processing: "Reading",
  failed: "Could not read",
  check: "Check",
  verified: "Verified",
  rejected: "Replaced",
  empty: "Nothing found",
};

interface DecideResult {
  confirmed: number;
  rejected: number;
  asked: { confirm: number; reject: number };
  skipped: string[];
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const month = (ym?: unknown) => (typeof ym === "string" && /^\d{4}-\d{2}$/.test(ym) ? `${MONTHS[Number(ym.slice(5)) - 1]} ${ym.slice(0, 4)}` : "");
const year = (ym?: unknown) => (typeof ym === "string" ? ym.slice(0, 4) : "");
const day = (iso: string) => {
  const d = new Date(iso);
  return `${d.getDate()} ${MONTHS[d.getMonth()]}`;
};

/** One row of the confirmed facts list: a label and the fact in one line. */
function factRow(f: Fact, index: number): { label: string; value: string } {
  const d = f.data as Record<string, string | number | string[] | undefined>;
  switch (f.kind) {
    case "employment":
      return {
        label: !d.end && index === 0 ? "Current role" : "Role",
        value: `${d.title}, ${d.company}. ${month(d.start)} to ${d.end ? month(d.end) : "now"}. ${Array.isArray(d.bullets) ? d.bullets.length : 0} lines`,
      };
    case "education":
      return { label: "Education", value: `${d.degree}${d.field ? `, ${d.field}` : ""}, ${d.institution}${d.end ? `, ${year(d.end)}` : ""}` };
    case "skill":
      return { label: "Skill", value: `${d.name}${d.years != null ? `, ${d.years} years` : ""}` };
    case "answer":
      return { label: String(d.question ?? "Answer"), value: String(d.answer ?? "") };
    case "contact":
      return { label: "Contact", value: [d.name, d.email, d.location].filter(Boolean).join(", ") };
    case "link":
      return { label: "Link", value: String(d.url ?? "") };
    case "project":
      return { label: "Project", value: String(d.name ?? "") };
    default:
      return { label: f.kind, value: JSON.stringify(d) };
  }
}

const RESUME_KINDS = new Set(["contact", "link", "employment", "education", "project", "skill", "answer"]);

export default function ProfilePage() {
  const [facts, setFacts] = useState<Fact[] | null>(null);
  const [docs, setDocs] = useState<Doc[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  /** Documents whose extraction issues the user has read, by id: Confirm all on a document with issues waits for this. */
  const [acknowledged, setAcknowledged] = useState<Record<string, boolean>>({});
  const fileRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    const r = await fetch("/api/profile");
    if (!r.ok) return;
    const j = (await r.json()) as { facts: Fact[]; documents: Doc[] };
    setFacts(j.facts);
    setDocs(j.documents);
  }, []);
  useEffect(() => {
    let alive = true;
    fetch("/api/profile")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((j: { facts: Fact[]; documents: Doc[] }) => {
        if (!alive) return;
        setFacts(j.facts);
        setDocs(j.documents);
      })
      .catch(() => showToast({ text: "Could not load your profile." }));
    return () => {
      alive = false;
    };
  }, []);

  /**
   * One decision or one replacement. The answer says what moved against
   * what was asked; a refusal carries its reason. Either way the list is
   * reloaded, so a stale page catches up rather than showing a click that
   * did nothing as done.
   */
  const decide = async (body: Record<string, unknown>, done: string) => {
    setBusy("decide");
    const r = await fetch("/api/profile/facts", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    setBusy(null);
    const j = (await r.json().catch(() => ({}))) as Partial<DecideResult> & { error?: string };
    await load();
    if (!r.ok) {
      showToast({ text: j.error ? `${j.error.charAt(0).toUpperCase()}${j.error.slice(1)}.` : "That did not save. Try again." });
      return;
    }
    if (j.asked && j.skipped?.length) {
      const asked = j.asked.confirm + j.asked.reject;
      showToast({ text: `${(j.confirmed ?? 0) + (j.rejected ?? 0)} of ${asked} saved. The rest had already changed, the list is refreshed.` });
      return;
    }
    showToast({ text: done });
  };

  /** One waiting fact rewritten by the user, at the version the page showed. The reload brings back the next version. */
  const [editing, setEditing] = useState<string | null>(null);
  const saveEdit = async (f: Fact, data: Record<string, unknown>) => {
    setBusy("decide");
    const r = await fetch("/api/profile/facts", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ edit: { id: f.id, version: f.version, data } }) });
    setBusy(null);
    const j = (await r.json().catch(() => ({}))) as { error?: string };
    if (!r.ok) {
      showToast({ text: j.error ? `${j.error.charAt(0).toUpperCase()}${j.error.slice(1)}.` : "That did not save. Try again." });
      if (r.status !== 422) await load();
      return;
    }
    setEditing(null);
    await load();
    showToast({ text: "Saved. Confirm it when it reads right." });
  };

  const upload = async (file: File) => {
    setBusy("upload");
    const form = new FormData();
    form.append("file", file);
    const r = await fetch("/api/profile/upload", { method: "POST", body: form });
    setBusy(null);
    if (!r.ok) {
      const j = (await r.json().catch(() => ({}))) as { error?: string };
      showToast({ text: j.error ?? "Upload failed." });
      return;
    }
    const j = (await r.json()) as { facts: number; issues: string[] };
    await load();
    showToast({ text: `${j.facts} facts read from ${file.name}. Check them below.${j.issues.length ? ` ${j.issues.length} to look at.` : ""}` });
  };

  const resumeFacts = (facts ?? []).filter((f) => RESUME_KINDS.has(f.kind) && f.status !== "rejected");
  const confirmed = resumeFacts.filter((f) => f.status === "confirmed");
  const pending = resumeFacts.filter((f) => f.status === "extracted");
  // Facts waiting for a decision, grouped under the document they came from, newest document first.
  // Confirm all sends that document's id, the one whose facts are on screen, never the latest upload.
  const pendingByDoc = docs.map((d) => ({ doc: d, facts: pending.filter((f) => f.documentId === d.id) })).filter((g) => g.facts.length > 0);
  const experience = confirmed.filter((f) => f.kind === "employment");
  const answers = confirmed.filter((f) => f.kind === "answer");
  const confirmedDoc = docs.find((d) => confirmed.some((f) => f.documentId === d.id));
  const factsFrom = confirmedDoc ? `from ${confirmedDoc.filename}, ${day(confirmedDoc.uploadedAt)}` : "entered by you";
  /** What a replacement removes, by kind, so the click says what it takes away before it is made. */
  const removals = (documentId: string) => {
    const gone = confirmed.filter((f) => f.documentId !== documentId);
    const n = (kind: string) => gone.filter((f) => f.kind === kind).length;
    const parts = [
      [n("employment"), "role", "roles"],
      [n("education"), "degree", "degrees"],
      [n("skill"), "skill", "skills"],
      [n("answer"), "answer", "answers"],
      [gone.length - n("employment") - n("education") - n("skill") - n("answer"), "other fact", "other facts"],
    ] as [number, string, string][];
    return { count: gone.length, text: parts.filter(([c]) => c > 0).map(([c, one, many]) => `${c} ${c === 1 ? one : many}`).join(", ") };
  };

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Profile</h1>
          <p className="sub">
            The facts every application is built from. Anything unverified stays out of
            your resumes.
          </p>
        </div>
        <Button variant="primary" onClick={() => showToast({ text: "Edit profile. Mock." })}>
          Edit profile
        </Button>
      </div>

      <div className="prof" style={{ gridTemplateColumns: "320px minmax(0,1fr)" }}>
        <div>
          <Card>
            <div style={{ textAlign: "center" }}>
              <span
                className="avatar"
                style={{ width: 48, height: 48, fontSize: "var(--text-md)", margin: "0 auto 10px" }}
              >
                JM
              </span>
              <b style={{ fontSize: "var(--text-md)", fontWeight: 500 }}>Jack Miller</b>
              <div className="sub">Strategy and transformation lead</div>
              <div className="sub">Istanbul, TR. Targeting US roles</div>
              <div className="row" style={{ justifyContent: "center", marginTop: 12 }}>
                <span className="tag strong">Profile 92% complete</span>
              </div>
            </div>
          </Card>

          <div style={{ marginTop: 12 }}>
            <Card title="Resume profiles">
              {docs.map((d) => (
                <div className="kvrow" key={d.id}>
                  <span className="k" style={{ width: "auto" }}>
                    <b style={{ color: "var(--fg)", fontWeight: 500 }}>{d.filename}</b>
                    <div className="sub">
                      Uploaded {day(d.uploadedAt)}.{" "}
                      {d.state === "processing"
                        ? "Reading it now."
                        : d.state === "failed"
                          ? "It could not be read. Upload it again or try another file."
                          : d.state === "empty"
                            ? "No facts were found in it."
                            : `${d.confirmed} confirmed${d.extracted ? `, ${d.extracted} to check` : ""}${d.rejected ? `, ${d.rejected} rejected` : ""}`}
                    </div>
                  </span>
                  <span className="tag">{DOC_TAG[d.state]}</span>
                </div>
              ))}
              {RESUMES.map(([name, meta, verified]) => (
                <div className="kvrow" key={name}>
                  <span className="k" style={{ width: "auto" }}>
                    <b style={{ color: "var(--fg)", fontWeight: 500 }}>{name}</b>
                    <div className="sub">{meta}</div>
                  </span>
                  {verified ? (
                    <span className="tag">Verified</span>
                  ) : (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => showToast({ text: "Download. This is a mock." })}
                    >
                      Download
                    </Button>
                  )}
                </div>
              ))}
              <input
                ref={fileRef}
                type="file"
                accept="application/pdf"
                style={{ display: "none" }}
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  e.target.value = "";
                  if (f) void upload(f);
                }}
              />
              <Button size="sm" style={{ marginTop: 10, width: "100%" }} disabled={busy === "upload"} onClick={() => fileRef.current?.click()}>
                {busy === "upload" ? "Reading your resume." : "Upload resume"}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                style={{ marginTop: 6, width: "100%" }}
                onClick={() => showToast({ text: "New resume profile. Mock." })}
              >
                New resume profile
              </Button>
            </Card>
          </div>
        </div>

        <div>
          <Card title="Work authorization">
            <div className="kvlist">
              {AUTH.map(([k, v]) => (
                <div className="kvrow" key={k}>
                  <span className="k">{k}</span>
                  <span className="v">{v}</span>
                </div>
              ))}
            </div>
            <p className="sub" style={{ margin: "12px 0 0" }}>
              These answers are entered by you, dated, and reused as is. Jobs that state no
              sponsorship are ruled out before ranking.
            </p>
          </Card>

          <div style={{ marginTop: 12 }}>
            <Card
              title="Target roles and locations"
              action={
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => showToast({ text: "Edit targets. Mock." })}
                >
                  Edit
                </Button>
              }
            >
              <div className="taglist">
                {TARGETS.map((t) => (
                  <span key={t}>{t}</span>
                ))}
              </div>
            </Card>
          </div>

          <div style={{ marginTop: 12 }}>
            <Card title="Confirmed facts">
              <p className="sub" style={{ margin: "0 0 10px" }}>
                {facts === null ? "Loading." : `${confirmed.length} confirmed ${factsFrom}. Only what you confirm can appear on a tailored resume.`}
                {pending.length > 0 ? ` ${pending.length} waiting for you. Confirm all replaces the facts you had before with that resume's.` : ""}
              </p>
              <div className="kvlist">
                {pendingByDoc.map(({ doc, facts: group }) => (
                  <div key={doc.id}>
                    <div className="kvrow">
                      <span className="k" style={{ width: "auto" }}>
                        <b style={{ color: "var(--fg)", fontWeight: 500 }}>From {doc.filename}</b>
                        <div className="sub">
                          Uploaded {day(doc.uploadedAt)}. {group.length} waiting for you.
                          {doc.state === "processing" ? " Still being read; decide when it is done." : doc.state === "failed" ? " Could not be read; these facts cannot be confirmed." : ""}
                        </div>
                        {removals(doc.id).count > 0 ? (
                          <div className="sub">
                            Confirm all replaces the {removals(doc.id).count} confirmed facts you have now, {removals(doc.id).text}, and withdraws anything else still waiting. Confirming one at a time adds
                            the fact beside them instead.
                          </div>
                        ) : null}
                        {doc.issues.length > 0 ? (
                          <div className="sub" style={{ marginTop: 6 }}>
                            {doc.issues.length} {doc.issues.length === 1 ? "line" : "lines"} could not be read as facts, so {doc.issues.length === 1 ? "it is" : "they are"} not below:
                            <ul style={{ margin: "4px 0 0", paddingLeft: 18 }}>
                              {doc.issues.map((issue, i) => (
                                <li key={i}>{issue}</li>
                              ))}
                            </ul>
                            <label className="row" style={{ gap: 6, marginTop: 6, cursor: "pointer" }}>
                              <input type="checkbox" checked={acknowledged[doc.id] ?? false} onChange={(e) => setAcknowledged({ ...acknowledged, [doc.id]: e.target.checked })} />
                              <span>I have read these. Confirm all may replace my profile without them.</span>
                            </label>
                          </div>
                        ) : null}
                      </span>
                      <Button
                        size="sm"
                        variant="primary"
                        disabled={busy === "decide" || editing !== null || doc.state !== "check" || (doc.issues.length > 0 && !acknowledged[doc.id])}
                        onClick={() =>
                          void decide(
                            { replaceWith: doc.id, seen: group.map((f) => ({ id: f.id, version: f.version })), ...(doc.issues.length ? { acknowledgeIssues: true } : {}) },
                            "Confirmed. Your profile is this resume now.",
                          )
                        }
                      >
                        Confirm all {group.length}
                      </Button>
                    </div>
                    {group.map((f, i) => {
                      const row = factRow(f, i);
                      const ref = { id: f.id, version: f.version };
                      return (
                        <div className="kvrow" key={f.id} style={{ alignItems: "flex-start" }}>
                          <span className="k">{row.label}</span>
                          <span className="v" style={{ fontWeight: 400, textAlign: "left" }}>
                            {editing === f.id ? (
                              <EditForm f={f} busy={busy === "decide"} onSave={(data) => void saveEdit(f, data)} onCancel={() => setEditing(null)} />
                            ) : (
                              <>
                                <FactDetail f={f} />
                                {f.evidence ? (
                                  <div className="sub">
                                    {f.origin === "edit" ? `Your resume said: ${f.evidence}. You changed it.` : `From the resume: ${f.evidence}`}
                                  </div>
                                ) : f.origin === "edit" ? (
                                  <div className="sub">You changed it.</div>
                                ) : null}
                              </>
                            )}
                          </span>
                          {editing === f.id ? null : (
                            <span className="row" style={{ gap: 6, flexShrink: 0 }}>
                              <Button size="sm" variant="ghost" disabled={busy === "decide" || editing !== null || doc.state !== "check"} onClick={() => setEditing(f.id)}>
                                Edit
                              </Button>
                              <Button size="sm" variant="ghost" disabled={busy === "decide" || editing !== null || doc.state !== "check"} onClick={() => void decide({ reject: [ref] }, "Rejected. It stays off your resumes.")}>
                                Reject
                              </Button>
                              <Button size="sm" disabled={busy === "decide" || editing !== null || doc.state !== "check"} onClick={() => void decide({ confirm: [ref] }, "Confirmed.")}>
                                Confirm
                              </Button>
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ))}
                {confirmed.map((f, i) => {
                  const row = factRow(f, i);
                  return (
                    <div className="kvrow" key={f.id}>
                      <span className="k">{row.label}</span>
                      <span className="v" style={{ fontWeight: 400, textAlign: "left" }}>
                        {row.value}
                      </span>
                      <span className="row" style={{ gap: 6, flexShrink: 0 }}>
                        <span className="tag">Confirmed</span>
                      </span>
                    </div>
                  );
                })}
                {facts !== null && resumeFacts.length === 0 ? <p className="sub">No resume facts yet. Upload a resume to start.</p> : null}
              </div>
            </Card>
          </div>

          <div style={{ marginTop: 12 }}>
            <Card title="Experience">
              <div className="kvlist">
                {experience.length
                  ? experience.map((f) => {
                      const d = f.data as { title: string; company: string; start: string; end?: string; bullets: string[] };
                      return (
                        <div className="kvrow" key={f.id}>
                          <span className="k">
                            {year(d.start)} to {d.end ? year(d.end) : "now"}
                          </span>
                          <span className="v" style={{ fontWeight: 400, textAlign: "left" }}>
                            <b style={{ fontWeight: 500 }}>
                              {d.title}, {d.company}
                            </b>
                            . {d.bullets[0]}
                          </span>
                        </div>
                      );
                    })
                  : EXPERIENCE.map(([when, role, note]) => (
                      <div className="kvrow" key={when}>
                        <span className="k">{when}</span>
                        <span className="v" style={{ fontWeight: 400, textAlign: "left" }}>
                          <b style={{ fontWeight: 500 }}>{role}</b>. {note}
                        </span>
                      </div>
                    ))}
              </div>
              <p className="sub" style={{ margin: "12px 0 0" }}>
                Extracted from your resume, confirmed by you.
              </p>
            </Card>
          </div>

          <div style={{ marginTop: 12 }}>
            <Card
              title="Saved answers"
              action={
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => showToast({ text: "Add answer. Mock." })}
                >
                  Add
                </Button>
              }
            >
              <div className="kvlist">
                {(answers.length
                  ? [...answers.map((f) => [String((f.data as { question: string }).question), String((f.data as { answer: string }).answer)] as [string, string, boolean?]), ANSWERS[2]]
                  : ANSWERS
                ).map(([k, v, unset]) => (
                  <div className="kvrow" key={k}>
                    <span className="k">{k}</span>
                    <span
                      className="v"
                      style={{
                        fontWeight: unset ? 400 : 500,
                        color: unset ? "var(--fg-subtle)" : "var(--fg)",
                      }}
                    >
                      {v}
                    </span>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        </div>
      </div>
    </>
  );
}
