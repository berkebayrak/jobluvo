"use client";

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

export default function ProfilePage() {
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
              <Button
                size="sm"
                style={{ marginTop: 10, width: "100%" }}
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
            <Card title="Experience">
              <div className="kvlist">
                {EXPERIENCE.map(([when, role, note]) => (
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
                {ANSWERS.map(([k, v, unset]) => (
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
