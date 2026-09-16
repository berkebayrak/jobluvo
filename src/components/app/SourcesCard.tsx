"use client";

import * as React from "react";
import { Card } from "@/components/data/Card";
import { logoUrl } from "@/lib/logo";

interface SourceRow {
  id: string;
  family: string;
  tenant: string;
  companyName: string;
  companyDomain: string | null;
  active: boolean;
  lastPolledAt: string | null;
  lastStatus: string | null;
  lastError: string | null;
  consecutiveFailures: number;
  jobCount: number;
}

const FAMILY_LABEL: Record<string, string> = {
  greenhouse: "Greenhouse",
  lever: "Lever",
  ashby: "Ashby",
  smartrecruiters: "SmartRecruiters",
  workable: "Workable",
  gem: "Gem",
};

function ago(iso: string | null): string {
  if (!iso) return "never";
  const min = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (min < 1) return "just now";
  if (min < 60) return `${min} min ago`;
  const h = Math.round(min / 60);
  if (h < 48) return `${h} h ago`;
  return `${Math.round(h / 24)} days ago`;
}

/**
 * The source registry with health. A paused source shows its last error, so
 * a broken board is visible here rather than in a log.
 */
export function SourcesCard() {
  const [rows, setRows] = React.useState<SourceRow[] | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let alive = true;
    fetch("/api/sources")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((d) => alive && setRows(d.sources))
      .catch((e) => alive && setError(e.message));
    return () => {
      alive = false;
    };
  }, []);

  const open = rows?.reduce((n, r) => n + r.jobCount, 0) ?? 0;

  return (
    <Card title="Job sources">
      {error && <p className="sub">Could not load sources. {error}</p>}
      {!rows && !error && <p className="sub">Loading.</p>}
      {rows && (
        <>
          <p className="sub" style={{ marginTop: 0 }}>
            {rows.length} boards on {new Set(rows.map((r) => r.family)).size} application systems, {open} open jobs.
            Each board is checked once a day.
          </p>
          <div className="kvlist">
            {rows.map((r) => (
              <div className="kvrow" key={r.id} style={{ alignItems: "flex-start" }}>
                <span className="k" style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  {r.companyDomain && (
                    // eslint-disable-next-line @next/next/no-img-element -- remote Logo.dev URLs
                    <img
                      src={logoUrl(r.companyDomain, 32)}
                      alt=""
                      style={{ width: 16, height: 16, borderRadius: 3, border: "1px solid var(--border)", objectFit: "contain" }}
                    />
                  )}
                  {r.companyName}
                  <span style={{ color: "var(--fg-subtle)" }}>{FAMILY_LABEL[r.family] ?? r.family}</span>
                </span>
                <span className="v" style={{ textAlign: "right" }}>
                  {r.active ? `${r.jobCount} open, checked ${ago(r.lastPolledAt)}` : "Paused"}
                  {r.lastError && (
                    <span style={{ display: "block", color: "var(--fg-subtle)", fontSize: "var(--text-xs)" }}>
                      {r.lastStatus === "paused" ? "Paused after 3 failures. " : "Last attempt failed. "}
                      {r.lastError}
                    </span>
                  )}
                </span>
              </div>
            ))}
          </div>
        </>
      )}
    </Card>
  );
}
