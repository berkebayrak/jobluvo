"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Banner } from "@/components/feedback/Banner";
import { Button } from "@/components/core/Button";
import { Card } from "@/components/data/Card";
import { JobCard } from "@/components/jobs/JobCard";
import { SwipeCard } from "@/components/jobs/SwipeCard";
import { Toggle } from "@/components/core/Toggle";
import { showToast } from "@/components/feedback/Toaster";
import { domains, jobs } from "@/lib/app/data";
import { logoUrl } from "@/lib/logo";

const FILTERS = [
  "Date",
  "Location",
  "Workplace",
  "Companies",
  "Seniority",
  "Sponsors visa",
  "Employment type",
  "Exclude keywords",
];

/** Twelve cards in today's deck, as the delivered app dealt them. */
const DECK = [0, 1, 2, 3, 4, 5, 6, 7, 0, 1, 2, 3];

function JobsScreen() {
  const router = useRouter();
  const params = useSearchParams();
  const [mode, setMode] = React.useState(params.get("mode") === "swipe" ? "swipe" : "list");
  const [autoApply, setAutoApply] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const [active, setActive] = React.useState<string[]>([]);
  const [saved, setSaved] = React.useState<number[]>([]);

  const [di, setDi] = React.useState(0);
  const [stamp, setStamp] = React.useState<"apply" | "skip" | null>(null);
  const [counts, setCounts] = React.useState({ apply: 0, save: 0, skip: 0 });

  const list = jobs.filter(
    (j) =>
      !query ||
      (j.title + j.co + j.summary).toLowerCase().includes(query.toLowerCase()),
  );

  const job = jobs[DECK[di] ?? 0];

  function swipe(action: "apply" | "skip" | "save") {
    if (action === "save") {
      setCounts((c) => ({ ...c, save: c.save + 1 }));
      showToast({ text: `Saved ${job.co}.`, actionLabel: "Undo" });
      return;
    }
    setStamp(action);
    setCounts((c) => ({ ...c, [action]: c[action] + 1 }));
    showToast({
      text:
        action === "apply"
          ? `Applying to ${job.co}. Resume tailored, submitting now.`
          : `Skipped ${job.co}. You will not see this again.`,
      actionLabel: "Undo",
    });
    window.setTimeout(() => {
      setStamp(null);
      setDi((n) => (n + 1) % DECK.length);
    }, 220);
  }

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Jobs</h1>
          <p className="sub">
            42 fresh matches. 18 above your Strategy lane&apos;s bar.
          </p>
        </div>
        <div className="row">
          <div className="row" style={{ gap: 8, marginRight: 8 }}>
            <span style={{ fontSize: "var(--text-sm)", fontWeight: 500 }}>Auto Apply</span>
            <Toggle on={autoApply} onChange={setAutoApply} />
          </div>
          <Button onClick={() => showToast({ text: "Paste a job link to add it." })}>
            Add a job link
          </Button>
          <div className="seg">
            <button className={mode === "list" ? "on" : undefined} onClick={() => setMode("list")}>
              List
            </button>
            <button
              className={mode === "swipe" ? "on" : undefined}
              onClick={() => setMode("swipe")}
            >
              Swipe
            </button>
          </div>
        </div>
      </div>

      <div className="toolbar">
        <div className="search">
          <input
            placeholder="Search by title, company or keyword"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        {FILTERS.map((f) => (
          <button
            key={f}
            className={`chip${active.includes(f) ? " on" : ""}`}
            onClick={() =>
              setActive((a) => (a.includes(f) ? a.filter((x) => x !== f) : [...a, f]))
            }
          >
            {f}
          </button>
        ))}
        {active.length > 0 && (
          <Button variant="ghost" size="sm" onClick={() => setActive([])}>
            Clear filters
          </Button>
        )}
        <span className="spacer" />
        <Button size="sm">Saved {saved.length}</Button>
      </div>

      {autoApply && (
        <div style={{ marginBottom: 16 }}>
          <Banner
            title="Auto Apply is on. Matches above your bar are applied for you."
            body="You are seeing what is left: jobs below your lanes' bar, jobs on unsupported sites, and jobs a lane held for your review. 11 applied today across 2 lanes."
            primary={
              <Button size="sm" onClick={() => router.push("/tracker")}>
                See what was sent
              </Button>
            }
          />
        </div>
      )}

      {mode === "list" ? (
        <div className="jobs-grid">
          {list.map((j, i) => (
            <JobCard
              key={`${j.co}-${i}`}
              company={j.co}
              logo={logoUrl(domains[j.co] ?? "example.com")}
              title={j.title}
              location={`${j.loc}. ${j.mode}`}
              salary={j.salary}
              ats={j.level}
              posted={j.age}
              match={j.p}
              reasons={j.why.map(([k, t]) => (k === "y" ? t : `- ${t}`))}
              onApply={() =>
                showToast({
                  text: `Applying to ${j.co}. Resume tailored, submitting now.`,
                  actionLabel: "Undo",
                })
              }
              onSave={() => {
                setSaved((s) => (s.includes(i) ? s : [...s, i]));
                showToast({ text: `Saved ${j.co}.` });
              }}
              onSkip={() => showToast({ text: `Skipped ${j.co}.` })}
            />
          ))}
        </div>
      ) : (
        <div className="swipe-wrap">
          <div>
            <div className="deck-hold">
              <div className="stack" style={{ transform: "scale(.92)" }} />
              <div className="stack" style={{ transform: "scale(.96)" }} />
              <SwipeCard
                company={job.co}
                logo={logoUrl(domains[job.co] ?? "example.com")}
                title={job.title}
                location={`${job.loc}. ${job.mode}`}
                posted={job.age}
                salary={job.salary}
                ats={job.level}
                match={job.p}
                reasons={job.why.map(([k, t]) => (k === "y" ? t : `- ${t}`))}
                footnote="Resume Strategy v3 will be tailored for this role."
                stamp={stamp}
                style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}
              />
            </div>
            <div className="swipe-actions">
              <Button onClick={() => swipe("skip")}>Skip</Button>
              <Button onClick={() => swipe("save")}>Save</Button>
              <Button variant="primary" onClick={() => swipe("apply")}>
                Apply
              </Button>
            </div>
            <p
              className="sub"
              style={{ textAlign: "center", marginTop: 10, maxWidth: 400 }}
            >
              Apply queues the job under your active mode. You get a 20 second window to
              undo before anything is prepared.
            </p>
          </div>

          <div>
            <Card title="Today's deck">
              <div className="side-stats">
                <span className="sub">
                  {di + 1} of {DECK.length}
                </span>
                <div className="progress">
                  <i style={{ width: `${((di + 1) / DECK.length) * 100}%` }} />
                </div>
                <div style={{ marginTop: 12 }}>
                  <div className="item">
                    <span>Applied from deck</span>
                    <b>{counts.apply}</b>
                  </div>
                  <div className="item">
                    <span>Saved</span>
                    <b>{counts.save}</b>
                  </div>
                  <div className="item">
                    <span>Skipped</span>
                    <b>{counts.skip}</b>
                  </div>
                  <div className="item">
                    <span>Mode</span>
                    <b>Review before submit</b>
                  </div>
                </div>
              </div>
            </Card>
            <div style={{ marginTop: 12 }}>
              <Card title="Deck rules">
                <p className="sub" style={{ margin: 0 }}>
                  Only jobs posted in the last 48 hours that pass your hard filters. Jobs
                  your lanes already applied to never appear here. Skips teach the ranking;
                  they never loosen your filters.
                </p>
              </Card>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default function JobsPage() {
  return (
    <React.Suspense fallback={null}>
      <JobsScreen />
    </React.Suspense>
  );
}
