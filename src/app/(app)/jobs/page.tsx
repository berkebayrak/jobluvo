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
import { ageHoursOf, cardFields, locationLabel, type FeedJob, type Viewer } from "@/lib/app/jobs-client";
import { logoUrl } from "@/lib/logo";

const DATE_OPTIONS: { label: string; hours: number }[] = [
  { label: "Last 24 hours", hours: 24 },
  { label: "Last 3 days", hours: 72 },
  { label: "Last week", hours: 168 },
];

const WORKPLACE_LABEL: Record<string, string> = {
  remote: "Remote",
  hybrid: "Hybrid",
  onsite: "On site",
  unknown: "Not stated",
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
function Opt({ label, on, onToggle }: { label: string; on: boolean; onToggle: () => void }) {
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

type Decision = "apply" | "save" | "skip";

async function postDecision(jobId: string, decision: Decision): Promise<boolean> {
  const r = await fetch("/api/swipe", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jobId, decision }),
  });
  return r.ok;
}

async function undoDecision(jobId: string): Promise<boolean> {
  const r = await fetch(`/api/swipe?jobId=${encodeURIComponent(jobId)}`, { method: "DELETE" });
  return r.ok;
}

function JobsScreen() {
  const router = useRouter();
  const params = useSearchParams();
  const [mode, setMode] = React.useState(params.get("mode") === "swipe" ? "swipe" : "list");
  const [autoApply, setAutoApply] = React.useState(false);
  const [query, setQuery] = React.useState("");

  const [all, setAll] = React.useState<FeedJob[] | null>(null);
  const [viewer, setViewer] = React.useState<Viewer | undefined>(undefined);
  const [loadError, setLoadError] = React.useState<string | null>(null);
  /** Jobs swiped this session, removed from view without a refetch. */
  const [gone, setGone] = React.useState<Set<string>>(new Set());
  const [savedCount, setSavedCount] = React.useState(0);

  React.useEffect(() => {
    let alive = true;
    fetch("/api/jobs")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((d: { jobs: FeedJob[]; viewer?: Viewer }) => {
        if (!alive) return;
        setAll(d.jobs);
        setViewer(d.viewer);
        setLoadError(null);
      })
      .catch((e: unknown) => alive && setLoadError(e instanceof Error ? e.message : String(e)));
    return () => {
      alive = false;
    };
  }, []);

  const [date, setDate] = React.useState<number | null>(null);
  const [loc, setLoc] = React.useState<string[]>([]);
  const [workplace, setWorkplace] = React.useState<string[]>([]);
  const [co, setCo] = React.useState<string[]>([]);
  const [level, setLevel] = React.useState<string[]>([]);
  const [sponsor, setSponsor] = React.useState(false);
  const [exclude, setExclude] = React.useState("");
  const [open, setOpen] = React.useState<string | null>(null);

  const jobs = React.useMemo(() => (all ?? []).filter((j) => !gone.has(j.id)), [all, gone]);

  /** Distinct values straight off the live data, so every option matches something. */
  const values = React.useMemo(
    () => ({
      loc: [...new Set(jobs.map(locationLabel))].sort(),
      workplace: [...new Set(jobs.map((j) => j.workplace))].sort(),
      co: [...new Set(jobs.map((j) => j.companyName))].sort(),
      level: [...new Set(jobs.map((j) => j.seniority).filter((s): s is string => !!s))].sort(),
    }),
    [jobs],
  );

  const activeCount =
    (date !== null ? 1 : 0) + loc.length + workplace.length + co.length + level.length + (sponsor ? 1 : 0) + (exclude.trim() ? 1 : 0);

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

  const words = exclude
    .toLowerCase()
    .split(",")
    .map((w) => w.trim())
    .filter(Boolean);

  const list = jobs.filter((j) => {
    const hay = `${j.title} ${j.companyName} ${j.locations.map((l) => l.raw).join(" ")}`.toLowerCase();
    if (query && !hay.includes(query.toLowerCase())) return false;
    if (date !== null && ageHoursOf(j.postedAt ?? j.firstSeenAt) > date) return false;
    if (loc.length && !loc.includes(locationLabel(j))) return false;
    if (workplace.length && !workplace.includes(j.workplace)) return false;
    if (co.length && !co.includes(j.companyName)) return false;
    if (level.length && !level.includes(j.seniority ?? "")) return false;
    if (sponsor && j.sponsorship !== "offered") return false;
    if (words.some((w) => hay.includes(w))) return false;
    return true;
  });

  const [stamp, setStamp] = React.useState<"apply" | "skip" | null>(null);
  const [counts, setCounts] = React.useState({ apply: 0, save: 0, skip: 0 });
  const deck = list;
  const job = deck[0];

  async function decide(j: FeedJob, decision: Decision) {
    const ok = await postDecision(j.id, decision);
    if (!ok) {
      showToast({ text: "Could not save that. Try again." });
      return;
    }
    setGone((g) => new Set(g).add(j.id));
    setCounts((c) => ({ ...c, [decision]: c[decision] + 1 }));
    if (decision === "save") setSavedCount((n) => n + 1);
    showToast({
      text:
        decision === "apply"
          ? `Queued ${j.companyName}. Tailoring arrives with the next release.`
          : decision === "save"
            ? `Saved ${j.companyName}.`
            : `Skipped ${j.companyName}. You will not see this again.`,
      actionLabel: "Undo",
      onAction: async () => {
        if (await undoDecision(j.id)) {
          setGone((g) => {
            const n = new Set(g);
            n.delete(j.id);
            return n;
          });
          setCounts((c) => ({ ...c, [decision]: Math.max(0, c[decision] - 1) }));
          if (decision === "save") setSavedCount((n) => Math.max(0, n - 1));
        }
      },
    });
  }

  function swipe(decision: Decision) {
    if (!job) return;
    if (decision === "save") {
      void decide(job, decision);
      return;
    }
    setStamp(decision);
    window.setTimeout(() => {
      setStamp(null);
      void decide(job, decision);
    }, 220);
  }

  const total = all?.length ?? 0;
  const subline =
    loadError
      ? `Could not load jobs. ${loadError}`
      : all === null
        ? "Loading jobs."
        : activeCount > 0 || query
          ? `${list.length} of ${jobs.length} jobs shown.`
          : `${jobs.length} open jobs from ${new Set(jobs.map((j) => j.companyName)).size} companies. Scores arrive once your profile is confirmed.`;

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Jobs</h1>
          <p className="sub">{subline}</p>
        </div>
        <div className="row">
          <div className="row" style={{ gap: 8, marginRight: 8 }}>
            <span style={{ fontSize: "var(--text-sm)", fontWeight: 500 }}>Auto Apply</span>
            <Toggle on={autoApply} onChange={setAutoApply} />
          </div>
          <Button onClick={() => showToast({ text: "Paste a job link to add it." })}>Add a job link</Button>
          <div className="seg">
            <button className={mode === "list" ? "on" : undefined} onClick={() => setMode("list")}>
              List
            </button>
            <button className={mode === "swipe" ? "on" : undefined} onClick={() => setMode("swipe")}>
              Swipe
            </button>
          </div>
        </div>
      </div>

      <div className="toolbar">
        <div className="search">
          <input
            placeholder="Search by title, company or location"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <FilterChip label="Date" count={date !== null ? 1 : 0} open={open === "date"} onOpen={() => setOpen(open === "date" ? null : "date")}>
          {DATE_OPTIONS.map((d) => (
            <Opt key={d.label} label={d.label} on={date === d.hours} onToggle={() => setDate(date === d.hours ? null : d.hours)} />
          ))}
        </FilterChip>

        <FilterChip label="Location" count={loc.length} open={open === "loc"} onOpen={() => setOpen(open === "loc" ? null : "loc")}>
          {values.loc.map((v) => (
            <Opt key={v} label={v} on={loc.includes(v)} onToggle={() => setLoc(toggle(loc, v))} />
          ))}
        </FilterChip>

        <FilterChip label="Workplace" count={workplace.length} open={open === "mode"} onOpen={() => setOpen(open === "mode" ? null : "mode")}>
          {values.workplace.map((v) => (
            <Opt key={v} label={WORKPLACE_LABEL[v] ?? v} on={workplace.includes(v)} onToggle={() => setWorkplace(toggle(workplace, v))} />
          ))}
        </FilterChip>

        <FilterChip label="Companies" count={co.length} open={open === "co"} onOpen={() => setOpen(open === "co" ? null : "co")}>
          {values.co.map((v) => (
            <Opt key={v} label={v} on={co.includes(v)} onToggle={() => setCo(toggle(co, v))} />
          ))}
        </FilterChip>

        <FilterChip label="Seniority" count={level.length} open={open === "level"} onOpen={() => setOpen(open === "level" ? null : "level")}>
          {values.level.map((v) => (
            <Opt key={v} label={v} on={level.includes(v)} onToggle={() => setLevel(toggle(level, v))} />
          ))}
        </FilterChip>

        <button className={`chip${sponsor ? " on" : ""}`} onClick={() => setSponsor(!sponsor)}>
          Sponsors visa
        </button>

        <FilterChip label="Exclude keywords" count={exclude.trim() ? 1 : 0} open={open === "excl"} onOpen={() => setOpen(open === "excl" ? null : "excl")}>
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
          <span style={{ fontSize: "var(--text-2xs)", color: "var(--fg-subtle)", display: "block", marginTop: 6 }}>
            Comma separated. A job matching any of these drops out.
          </span>
        </FilterChip>

        {activeCount > 0 && (
          <Button variant="ghost" size="sm" onClick={clearAll}>
            Clear filters
          </Button>
        )}
        <span className="spacer" />
        <Button size="sm">Saved {savedCount}</Button>
      </div>

      {autoApply && (
        <div style={{ marginBottom: 16 }}>
          <Banner
            title="Auto Apply is on. Matches above your bar are applied for you."
            body="You are seeing what is left: jobs below your lanes' bar, jobs on unsupported sites, and jobs a lane held for your review."
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
          {list.map((j) => {
            const f = cardFields(j, viewer);
            return (
              <JobCard
                key={j.id}
                company={f.company}
                logo={f.logoDomain ? logoUrl(f.logoDomain) : undefined}
                title={f.title}
                location={f.location}
                salary={f.salary}
                ats={f.ats}
                posted={f.posted}
                reasons={f.reasons}
                onApply={() => decide(j, "apply")}
                onSave={() => decide(j, "save")}
                onSkip={() => decide(j, "skip")}
              />
            );
          })}
          {all && list.length === 0 && (
            <p className="sub">{total === 0 ? "No open jobs yet. The first ingest fills this in." : "Nothing matches these filters."}</p>
          )}
        </div>
      ) : (
        <div className="swipe-wrap">
          <div>
            <div className="deck-hold">
              <div className="stack" style={{ transform: "scale(.92)" }} />
              <div className="stack" style={{ transform: "scale(.96)" }} />
              {job ? (
                (() => {
                  const f = cardFields(job, viewer);
                  return (
                    <SwipeCard
                      company={f.company}
                      logo={f.logoDomain ? logoUrl(f.logoDomain) : undefined}
                      title={f.title}
                      location={f.location}
                      posted={f.posted}
                      salary={f.salary}
                      ats={f.ats}
                      reasons={f.reasons}
                      footnote="Resume Strategy v3 will be tailored for this role."
                      stamp={stamp}
                      style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}
                    />
                  );
                })()
              ) : (
                <p className="sub" style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", margin: 0 }}>
                  {all === null ? "Loading." : "Deck is empty."}
                </p>
              )}
            </div>
            <div className="swipe-actions">
              <Button onClick={() => swipe("skip")} disabled={!job}>
                Skip
              </Button>
              <Button onClick={() => swipe("save")} disabled={!job}>
                Save
              </Button>
              <Button variant="primary" onClick={() => swipe("apply")} disabled={!job}>
                Apply
              </Button>
            </div>
            <p className="sub" style={{ textAlign: "center", marginTop: 10, maxWidth: 400 }}>
              Apply queues the job under your active mode. Undo from the toast reverses it.
            </p>
          </div>

          <div>
            <Card title="Today's deck">
              <div className="side-stats">
                <span className="sub">{deck.length} left</span>
                <div className="progress">
                  <i style={{ width: `${jobs.length ? ((jobs.length - deck.length) / jobs.length) * 100 : 0}%` }} />
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
                  One card per job, even when it is listed on several systems. Skips teach the
                  ranking; they never loosen your filters.
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
