"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/core/Button";
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
}

interface Doc {
  id: string;
  filename: string;
  uploadedAt: string;
  status: "processing" | "ready" | "failed";
  state: "processing" | "failed" | "check" | "verified" | "rejected" | "empty";
  error: string | null;
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
                        </div>
                      </span>
                      <Button size="sm" variant="primary" disabled={busy === "decide"} onClick={() => void decide({ replaceWith: doc.id }, "Confirmed. Your profile is this resume now.")}>
                        Confirm all {group.length}
                      </Button>
                    </div>
                    {group.map((f, i) => {
                      const row = factRow(f, i);
                      return (
                        <div className="kvrow" key={f.id}>
                          <span className="k">{row.label}</span>
                          <span className="v" style={{ fontWeight: 400, textAlign: "left" }}>
                            {row.value}
                            {f.evidence ? <div className="sub">From the resume: {f.evidence}</div> : null}
                          </span>
                          <span className="row" style={{ gap: 6, flexShrink: 0 }}>
                            <Button size="sm" variant="ghost" disabled={busy === "decide"} onClick={() => void decide({ reject: [f.id] }, "Rejected. It stays off your resumes.")}>
                              Reject
                            </Button>
                            <Button size="sm" disabled={busy === "decide"} onClick={() => void decide({ confirm: [f.id] }, "Confirmed.")}>
                              Confirm
                            </Button>
                          </span>
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
