"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Banner } from "@/components/feedback/Banner";
import { Button } from "@/components/core/Button";
import { JobCard } from "@/components/jobs/JobCard";
import { Modal } from "@/components/feedback/Modal";
import { StatTile } from "@/components/data/StatTile";
import { StatusTag } from "@/components/data/StatusTag";
import { TableRow } from "@/components/data/TableRow";
import { showToast } from "@/components/feedback/Toaster";
import { useDensity } from "@/components/app/density";
import { apps, domains, jobs, lanes, statusFilters, statusMap } from "@/lib/app/data";
import { logoUrl } from "@/lib/logo";

const DASH_PICK = [0, 1, 2, 3];
const COLS = "minmax(0,2.4fr) 90px minmax(0,1.2fr) 130px 110px";

export default function DashboardPage() {
  const router = useRouter();
  const [filter, setFilter] = React.useState("All");
  const [query, setQuery] = React.useState("");
  const [showAll, setShowAll] = React.useState(false);
  const [answerOpen, setAnswerOpen] = React.useState(false);
  const { density } = useDensity();

  const rows = apps.filter(
    (a) =>
      (filter === "All" || a.st === filter) &&
      (!query || a.co.toLowerCase().includes(query.toLowerCase())),
  );
  const shown = showAll ? rows : rows.slice(0, 8);
  const held = apps.filter((a) => a.st === "Held for review").length;

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Good afternoon, Jack</h1>
          <p className="sub">
            Saturday, 12 September. Two lanes ran overnight and one application needs you.
          </p>
        </div>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "flex-end",
            gap: 8,
          }}
        >
          {/* Quiet, not a highlight: grey-500 rather than the grey-700 body tone. */}
          <span style={{ fontSize: "var(--text-xs)", color: "var(--fg-subtle)" }}>
            Max. 1,412 applications left
          </span>
          <div className="row">
            <Button onClick={() => router.push("/jobs?mode=swipe")}>
              Swipe today&apos;s picks
            </Button>
            <Button variant="primary" onClick={() => router.push("/auto-apply")}>
              Manage lanes
            </Button>
          </div>
        </div>
      </div>

      <Banner
        title="Salesforce needs a screening answer."
        body="The form asks about export control status. Your profile has no value for this, so the application is on hold until you answer. It will not be guessed."
        primary={
          <Button variant="primary" size="sm" onClick={() => setAnswerOpen(true)}>
            Answer
          </Button>
        }
      />

      <div className="g4 section">
        <StatTile label="Applied this week" value="38" note="12 more than last week" />
        <StatTile label="Waiting on you" value="1" note="Screening question on hold" />
        <StatTile label="Employer replies" value="6" note="3 new in inbox" />
        <StatTile label="Interviews" value="2" note="Next: Tue 15 Sep, 10:00 CT" />
      </div>

      <div className="dash-cols section">
        <div className="panel">
          <div className="panel-head">
            <h2>Top matches</h2>
            <Button variant="ghost" size="sm" onClick={() => router.push("/jobs")}>
              All 42 matches
            </Button>
          </div>
          <div className="panel-body jobs-grid">
            {DASH_PICK.map((i) => {
              const j = jobs[i];
              return (
                <JobCard
                  key={j.co}
                  company={j.co}
                  logo={logoUrl(domains[j.co] ?? "example.com")}
                  title={j.title}
                  location={j.loc}
                  salary={j.salary}
                  ats={j.mode}
                  posted={j.age}
                  match={j.p}
                  reasons={j.why.map(([k, t]) => (k === "y" ? t : `- ${t}`))}
                  onApply={() =>
                    showToast({
                      text: `Applying to ${j.co}. Resume tailored, submitting now.`,
                      actionLabel: "Undo",
                    })
                  }
                  onSave={() => showToast({ text: "Saved to your list." })}
                  onSkip={() => showToast({ text: "Skipped. You will not see this again." })}
                />
              );
            })}
          </div>
        </div>

        <div className="panel">
          <div className="panel-head">
            <h2>Lanes</h2>
            <Button variant="ghost" size="sm" onClick={() => router.push("/auto-apply")}>
              Auto Apply
            </Button>
          </div>
          {lanes.map((l, i) => (
            <div
              key={l.id}
              className={`lane-row${i === 0 ? " on" : ""}`}
              onClick={() => router.push("/auto-apply")}
            >
              <div className="name">
                {l.name}
                <span className={`tag${l.status === "Running" ? " strong" : " quiet"}`}>
                  {l.status}
                </span>
              </div>
              <div className="desc">
                {l.resume}. {l.quality} matches. {l.filters[0]}
              </div>
              <div className="kv">
                <span>
                  Today <b>{l.today}</b>
                </span>
                <span>
                  Review <b>{l.review ? "On" : "Off"}</b>
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="panel section">
        <div className="panel-head">
          <h2>All applications</h2>
          <div className="row">
            <div className="search" style={{ minWidth: 200 }}>
              <input
                placeholder="Search company"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>
            <Button
              size="sm"
              onClick={() => showToast({ text: `Approved ${held} held applications.` })}
            >
              Approve all held ({held})
            </Button>
          </div>
        </div>

        <div className="panel-body" style={{ paddingBottom: 0 }}>
          <div className="toolbar">
            {statusFilters.map((s) => (
              <button
                key={s}
                className={`chip${s === filter ? " on" : ""}`}
                onClick={() => setFilter(s)}
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        <TableRow
          header
          columns={COLS}
          cells={["Company", "Resume", "Lane", "Status", "Applied"]}
        />
        {shown.map((a, i) => (
          <TableRow
            key={`${a.co}-${a.t}-${i}`}
            columns={COLS}
            density={density}
            onClick={() => showToast({ text: `${a.co}. ${a.t}.` })}
            cells={[
              <span key="c">
                <b style={{ fontWeight: 500 }}>{a.co}</b>{" "}
                <span style={{ color: "var(--fg-subtle)" }}>{a.t}</span>
              </span>,
              a.r,
              a.l,
              <StatusTag key="s" status={statusMap[a.st] ?? "submitted"} size="sm" />,
              <span key="d" style={{ color: "var(--fg-subtle)" }}>
                {a.d || a.note || ""}
              </span>,
            ]}
          />
        ))}
        <div className="row" style={{ justifyContent: "center", padding: 8 }}>
          <Button variant="ghost" size="sm" onClick={() => setShowAll(!showAll)}>
            {showAll ? "Show fewer" : `Show all ${rows.length}`}
          </Button>
        </div>
      </div>

      <Modal
        open={answerOpen}
        title="Export control status"
        confirmLabel="Save and resume"
        onCancel={() => setAnswerOpen(false)}
        onConfirm={() => {
          setAnswerOpen(false);
          showToast({ text: "Saved. The Salesforce application resumed." });
        }}
      >
        Salesforce asks whether you are subject to export control restrictions. Nothing is
        guessed, so the application waits until you answer. The answer is saved to your
        profile for next time.
      </Modal>
    </>
  );
}
