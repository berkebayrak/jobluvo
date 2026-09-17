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
import { cardFields, type FeedJob, type Viewer } from "@/lib/app/jobs-client";
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

const PAGE = 200;

/** Digits with a thousands separator, per the copy rules. */
const num = (n: number) => n.toLocaleString("en-US");

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

interface FeedPage {
  jobs: FeedJob[];
  total: number;
  inventory: { jobs: number; companies: number };
  hidden: { total: number; reasons: Record<string, number> };
  facets: { loc: string[]; workplace: string[]; co: string[]; level: string[] };
  viewer?: Viewer;
}

const EMPTY_FACETS: FeedPage["facets"] = { loc: [], workplace: [], co: [], level: [] };

function JobsScreen() {
  const router = useRouter();
  const params = useSearchParams();
  const [mode, setMode] = React.useState(params.get("mode") === "swipe" ? "swipe" : "list");
  const [autoApply, setAutoApply] = React.useState(false);
  const [query, setQuery] = React.useState("");

  const [date, setDate] = React.useState<number | null>(null);
  const [loc, setLoc] = React.useState<string[]>([]);
  const [workplace, setWorkplace] = React.useState<string[]>([]);
  const [co, setCo] = React.useState<string[]>([]);
  const [level, setLevel] = React.useState<string[]>([]);
  const [sponsor, setSponsor] = React.useState(false);
  const [exclude, setExclude] = React.useState("");
  const [open, setOpen] = React.useState<string | null>(null);

  /*
   * The feed is filtered and paged on the server. `rows` is the loaded page or
   * pages; `total` is how many jobs match the filters across the whole
   * inventory; `inventory` is the whole inventory before any filter. Numbers
   * on screen come from the database, never from the length of a window.
   */
  const [rows, setRows] = React.useState<FeedJob[] | null>(null);
  const [total, setTotal] = React.useState(0);
  const [inventory, setInventory] = React.useState({ jobs: 0, companies: 0 });
  const [hidden, setHidden] = React.useState(0);
  const [facets, setFacets] = React.useState(EMPTY_FACETS);
  const [viewer, setViewer] = React.useState<Viewer | undefined>(undefined);
  const [loadError, setLoadError] = React.useState<string | null>(null);
  const [loadingMore, setLoadingMore] = React.useState(false);
  /*
   * Which set of filters the rows on screen belong to. Every filter change
   * bumps it, and a Show more page is thrown away when it comes back to a
   * different generation, so a slow second page can never be appended under
   * filters it was not asked for.
   */
  const generation = React.useRef(0);
  /*
   * Jobs whose decision is in flight or already recorded. The upsert leaves
   * one row however many times it is called, but each call here moves the
   * counters, so a second tap on the same card must do nothing. An id leaves
   * the set only when the post fails or when Undo puts the job back.
   */
  const deciding = React.useRef<Set<string>>(new Set());

  const search = React.useMemo(() => {
    const p = new URLSearchParams();
    if (query.trim()) p.set("q", query.trim());
    if (date !== null) p.set("hours", String(date));
    for (const v of loc) p.append("loc", v);
    for (const v of workplace) p.append("workplace", v);
    for (const v of co) p.append("co", v);
    for (const v of level) p.append("level", v);
    if (sponsor) p.set("sponsor", "1");
    if (exclude.trim()) p.set("exclude", exclude.trim());
    return p.toString();
  }, [query, date, loc, workplace, co, level, sponsor, exclude]);

  React.useEffect(() => {
    let alive = true;
    generation.current += 1;
    const mine = generation.current;
    const timer = window.setTimeout(() => {
      fetch(`/api/jobs?${search}`)
        .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
        .then((d: FeedPage) => {
          if (!alive || generation.current !== mine) return;
          setRows(d.jobs);
          setTotal(d.total);
          setInventory(d.inventory);
          setHidden(d.hidden?.total ?? 0);
          setFacets(d.facets);
          setViewer(d.viewer);
          setLoadError(null);
        })
        .catch((e: unknown) => alive && setLoadError(e instanceof Error ? e.message : String(e)));
    }, 250);
    return () => {
      alive = false;
      window.clearTimeout(timer);
    };
  }, [search]);

  function showMore() {
    if (!rows || loadingMore) return;
    const mine = generation.current;
    setLoadingMore(true);
    fetch(`/api/jobs?${search}&offset=${rows.length}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((d: FeedPage) => {
        if (generation.current !== mine) return;
        setRows((cur) => [...(cur ?? []), ...d.jobs]);
        setTotal(d.total);
      })
      .catch((e: unknown) => generation.current === mine && setLoadError(e instanceof Error ? e.message : String(e)))
      .finally(() => setLoadingMore(false));
  }

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

  const list = rows ?? [];
  const [stamp, setStamp] = React.useState<"apply" | "skip" | null>(null);
  const [counts, setCounts] = React.useState({ apply: 0, save: 0, skip: 0 });
  const [savedCount, setSavedCount] = React.useState(0);
  const job = list[0];

  async function decide(j: FeedJob, decision: Decision) {
    if (deciding.current.has(j.id)) return;
    deciding.current.add(j.id);
    const ok = await postDecision(j.id, decision);
    if (!ok) {
      deciding.current.delete(j.id);
      showToast({ text: "Could not save that. Try again." });
      return;
    }
    const index = list.findIndex((x) => x.id === j.id);
    setRows((cur) => (cur ?? []).filter((x) => x.id !== j.id));
    setTotal((n) => Math.max(0, n - 1));
    setInventory((inv) => ({ ...inv, jobs: Math.max(0, inv.jobs - 1) }));
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
          deciding.current.delete(j.id);
          setRows((cur) => {
            const next = [...(cur ?? [])];
            next.splice(Math.max(0, index), 0, j);
            return next;
          });
          setTotal((n) => n + 1);
          setInventory((inv) => ({ ...inv, jobs: inv.jobs + 1 }));
          setCounts((c) => ({ ...c, [decision]: Math.max(0, c[decision] - 1) }));
          if (decision === "save") setSavedCount((n) => Math.max(0, n - 1));
        }
      },
    });
  }

  function swipe(decision: Decision) {
    if (!job || deciding.current.has(job.id)) return;
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

  const decided = counts.apply + counts.save + counts.skip;
  const subline = loadError
    ? `Could not load jobs. ${loadError}`
    : rows === null
      ? "Loading jobs."
      : activeCount > 0 || query
        ? `${num(total)} of ${num(inventory.jobs)} jobs shown.`
        : `${num(inventory.jobs)} open jobs from ${num(inventory.companies)} companies.${hidden ? ` ${num(hidden)} more do not fit your profile.` : ""} Scores arrive once your profile is confirmed.`;

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
          {facets.loc.map((v) => (
            <Opt key={v} label={v} on={loc.includes(v)} onToggle={() => setLoc(toggle(loc, v))} />
          ))}
        </FilterChip>

        <FilterChip label="Workplace" count={workplace.length} open={open === "mode"} onOpen={() => setOpen(open === "mode" ? null : "mode")}>
          {facets.workplace.map((v) => (
            <Opt key={v} label={WORKPLACE_LABEL[v] ?? v} on={workplace.includes(v)} onToggle={() => setWorkplace(toggle(workplace, v))} />
          ))}
        </FilterChip>

        <FilterChip label="Companies" count={co.length} open={open === "co"} onOpen={() => setOpen(open === "co" ? null : "co")}>
          {facets.co.map((v) => (
            <Opt key={v} label={v} on={co.includes(v)} onToggle={() => setCo(toggle(co, v))} />
          ))}
        </FilterChip>

        <FilterChip label="Seniority" count={level.length} open={open === "level"} onOpen={() => setOpen(open === "level" ? null : "level")}>
          {facets.level.map((v) => (
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
        <>
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
            {rows && list.length === 0 && (
              <p className="sub">{inventory.jobs === 0 ? "No open jobs yet. The first ingest fills this in." : "Nothing matches these filters."}</p>
            )}
          </div>
          {rows && list.length < total && (
            <div className="row" style={{ justifyContent: "center", marginTop: 16, gap: 12 }}>
              <span className="sub">
                {num(list.length)} of {num(total)} shown.
              </span>
              <Button size="sm" onClick={showMore} disabled={loadingMore}>
                {loadingMore ? "Loading." : `Show ${num(Math.min(PAGE, total - list.length))} more`}
              </Button>
            </div>
          )}
        </>
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
                  {rows === null ? "Loading." : "Deck is empty."}
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
                <span className="sub">{num(total)} left</span>
                <div className="progress">
                  <i style={{ width: `${decided + total ? (decided / (decided + total)) * 100 : 0}%` }} />
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
