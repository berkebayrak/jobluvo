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

/** "8 hours ago" and "2 days ago" both become hours, so Date can compare. */
function ageHours(age: string): number {
  const m = /(\d+)\s*(hour|day|week)/.exec(age);
  if (!m) return 9999;
  const n = Number(m[1]);
  return m[2] === "hour" ? n : m[2] === "day" ? n * 24 : n * 168;
}

const DATE_OPTIONS: { label: string; hours: number }[] = [
  { label: "Last 24 hours", hours: 24 },
  { label: "Last 3 days", hours: 72 },
  { label: "Last week", hours: 168 },
];

/** Distinct values straight off the job data, so every option matches something. */
const VALUES = {
  loc: [...new Set(jobs.map((j) => j.loc))].sort(),
  mode: [...new Set(jobs.map((j) => j.mode))].sort(),
  co: [...new Set(jobs.map((j) => j.co))].sort(),
  level: [...new Set(jobs.map((j) => j.level))].sort(),
};

function toggle(list: string[], v: string): string[] {
  return list.includes(v) ? list.filter((x) => x !== v) : [...list, v];
}

/** A chip that opens a small panel of options. */
function FilterChip({
  label,
  count,
  open,
  onOpen,
  children,
}: {
  label: string;
  count: number;
  open: boolean;
  onOpen: () => void;
  children: React.ReactNode;
}) {
  const ref = React.useRef<HTMLSpanElement>(null);

  React.useEffect(() => {
    function onDown(e: MouseEvent) {
      if (open && ref.current && !ref.current.contains(e.target as Node)) onOpen();
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open, onOpen]);

  return (
    <span ref={ref} style={{ position: "relative" }}>
      <button className={`chip${count > 0 ? " on" : ""}`} onClick={onOpen}>
        {label}
        {count > 0 ? ` ${count}` : ""}
      </button>
      {open && (
        <div
          style={{
            position: "absolute",
            top: 34,
            left: 0,
            zIndex: 30,
            minWidth: 220,
            maxHeight: 280,
            overflowY: "auto",
            background: "var(--surface-0)",
            border: "1px solid var(--border-strong)",
            borderRadius: "var(--radius-sm)",
            padding: 8,
          }}
        >
          {children}
        </div>
      )}
    </span>
  );
}

/** One option row. Checked state is a glyph, never colour. */
function Opt({
  label,
  on,
  onToggle,
}: {
  label: string;
  on: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      onClick={onToggle}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        width: "100%",
        textAlign: "left",
        border: 0,
        background: "transparent",
        padding: "6px 6px",
        borderRadius: "var(--radius-xs)",
        font: "inherit",
        fontSize: "var(--text-sm)",
        color: "var(--fg)",
        cursor: "pointer",
      }}
    >
      <span
        aria-hidden="true"
        style={{
          width: 14,
          height: 14,
          flex: "none",
          display: "grid",
          placeItems: "center",
          border: `1px solid ${on ? "var(--accent)" : "var(--border-strong)"}`,
          borderRadius: "var(--radius-xs)",
          background: on ? "var(--accent)" : "var(--surface-0)",
          color: "var(--fg-inverse)",
          fontSize: 10,
          lineHeight: 1,
        }}
      >
        {on ? "+" : ""}
      </span>
      {label}
    </button>
  );
}

/** One card per job, dealt once. */
const DECK = jobs.map((_, i) => i);

function JobsScreen() {
  const router = useRouter();
  const params = useSearchParams();
  const [mode, setMode] = React.useState(params.get("mode") === "swipe" ? "swipe" : "list");
  const [autoApply, setAutoApply] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const [saved, setSaved] = React.useState<number[]>([]);

  const [date, setDate] = React.useState<number | null>(null);
  const [loc, setLoc] = React.useState<string[]>([]);
  const [workplace, setWorkplace] = React.useState<string[]>([]);
  const [co, setCo] = React.useState<string[]>([]);
  const [level, setLevel] = React.useState<string[]>([]);
  const [sponsor, setSponsor] = React.useState(false);
  const [exclude, setExclude] = React.useState("");
  const [open, setOpen] = React.useState<string | null>(null);

  const activeCount =
    (date !== null ? 1 : 0) +
    loc.length +
    workplace.length +
    co.length +
    level.length +
    (sponsor ? 1 : 0) +
    (exclude.trim() ? 1 : 0);

  function clearAll() {
    setDate(null);
    setLoc([]);
    setWorkplace([]);
    setCo([]);
    setLevel([]);
    setSponsor(false);
    setExclude("");
    setOpen(null);
  }

  const [di, setDi] = React.useState(0);
  const [stamp, setStamp] = React.useState<"apply" | "skip" | null>(null);
  const [counts, setCounts] = React.useState({ apply: 0, save: 0, skip: 0 });

  const words = exclude
    .toLowerCase()
    .split(",")
    .map((w) => w.trim())
    .filter(Boolean);

  const list = jobs.filter((j) => {
    const hay = (j.title + " " + j.co + " " + j.summary).toLowerCase();
    if (query && !hay.includes(query.toLowerCase())) return false;
    if (date !== null && ageHours(j.age) > date) return false;
    if (loc.length && !loc.includes(j.loc)) return false;
    if (workplace.length && !workplace.includes(j.mode)) return false;
    if (co.length && !co.includes(j.co)) return false;
    if (level.length && !level.includes(j.level)) return false;
    if (sponsor && j.sponsor !== "Yes") return false;
    if (words.some((w) => hay.includes(w))) return false;
    return true;
  });

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
            {activeCount > 0 || query
              ? `${list.length} of ${jobs.length} matches shown.`
              : "42 fresh matches. 18 above your Strategy lane\u2019s bar."}
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
        <FilterChip
          label="Date"
          count={date !== null ? 1 : 0}
          open={open === "date"}
          onOpen={() => setOpen(open === "date" ? null : "date")}
        >
          {DATE_OPTIONS.map((d) => (
            <Opt
              key={d.label}
              label={d.label}
              on={date === d.hours}
              onToggle={() => setDate(date === d.hours ? null : d.hours)}
            />
          ))}
        </FilterChip>

        <FilterChip
          label="Location"
          count={loc.length}
          open={open === "loc"}
          onOpen={() => setOpen(open === "loc" ? null : "loc")}
        >
          {VALUES.loc.map((v) => (
            <Opt key={v} label={v} on={loc.includes(v)} onToggle={() => setLoc(toggle(loc, v))} />
          ))}
        </FilterChip>

        <FilterChip
          label="Workplace"
          count={workplace.length}
          open={open === "mode"}
          onOpen={() => setOpen(open === "mode" ? null : "mode")}
        >
          {VALUES.mode.map((v) => (
            <Opt
              key={v}
              label={v}
              on={workplace.includes(v)}
              onToggle={() => setWorkplace(toggle(workplace, v))}
            />
          ))}
        </FilterChip>

        <FilterChip
          label="Companies"
          count={co.length}
          open={open === "co"}
          onOpen={() => setOpen(open === "co" ? null : "co")}
        >
          {VALUES.co.map((v) => (
            <Opt key={v} label={v} on={co.includes(v)} onToggle={() => setCo(toggle(co, v))} />
          ))}
        </FilterChip>

        <FilterChip
          label="Seniority"
          count={level.length}
          open={open === "level"}
          onOpen={() => setOpen(open === "level" ? null : "level")}
        >
          {VALUES.level.map((v) => (
            <Opt
              key={v}
              label={v}
              on={level.includes(v)}
              onToggle={() => setLevel(toggle(level, v))}
            />
          ))}
        </FilterChip>

        <button className={`chip${sponsor ? " on" : ""}`} onClick={() => setSponsor(!sponsor)}>
          Sponsors visa
        </button>

        <FilterChip
          label="Exclude keywords"
          count={exclude.trim() ? 1 : 0}
          open={open === "excl"}
          onOpen={() => setOpen(open === "excl" ? null : "excl")}
        >
          <input
            placeholder="pre-sales, clearance"
            value={exclude}
            onChange={(e) => setExclude(e.target.value)}
            style={{
              width: "100%",
              height: "var(--control-sm)",
              padding: "0 8px",
              border: "1px solid var(--border-strong)",
              borderRadius: "var(--radius-sm)",
              background: "var(--surface-0)",
              font: "inherit",
              fontSize: "var(--text-sm)",
              color: "var(--fg)",
              outline: 0,
            }}
          />
          <span
            style={{
              fontSize: "var(--text-2xs)",
              color: "var(--fg-subtle)",
              display: "block",
              marginTop: 6,
            }}
          >
            Comma separated. A job matching any of these drops out.
          </span>
        </FilterChip>

        {activeCount > 0 && (
          <Button variant="ghost" size="sm" onClick={clearAll}>
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
