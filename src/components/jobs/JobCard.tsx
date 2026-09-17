"use client";

import * as React from "react";
import { useHover } from "../useHover";
import { Button } from "../core/Button";

export interface JobCardProps {
  company: string;
  logo?: string;
  title: string;
  location: string;
  salary?: string;
  /** Application system, e.g. Greenhouse */
  ats?: string;
  posted?: string;
  /** Absent until the job has been scored; the card then shows "New" in place of the number. */
  match?: number;
  /** Prefix with "-" for a reason against. Others read as for. */
  reasons?: string[];
  onApply?: () => void;
  onSave?: () => void;
  onSkip?: () => void;
}

/**
 * List view unit. The match number is the only large type. Reasons are the
 * honest part; always include at least one minus.
 */
export function JobCard({
  company,
  logo,
  title,
  location,
  salary,
  ats,
  posted,
  match,
  reasons = [],
  onApply,
  onSave,
  onSkip,
}: JobCardProps) {
  const [{ hover }, h] = useHover();

  return (
    <article
      {...h}
      style={{
        border: `1px solid ${hover ? "var(--border-strong)" : "var(--border)"}`,
        borderRadius: "var(--radius-md)",
        padding: 16,
        display: "flex",
        flexDirection: "column",
        gap: 12,
        background: hover ? "var(--surface-1)" : "var(--surface-0)",
        fontFamily: "var(--font-sans)",
        fontSize: "var(--text-sm)",
        lineHeight: "var(--leading-sm)",
      }}
    >
      <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
        {logo && (
          // eslint-disable-next-line @next/next/no-img-element -- remote Logo.dev URLs, no loader configured
          <img
            src={logo}
            alt={company}
            style={{
              width: 32,
              height: 32,
              borderRadius: "var(--radius-sm)",
              border: "1px solid var(--border)",
              objectFit: "contain",
              background: "var(--surface-0)",
              flex: "none",
            }}
          />
        )}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontWeight: 500,
              fontSize: "var(--text-base)",
              textWrap: "pretty",
            }}
          >
            {title}
          </div>
          <div style={{ fontSize: "var(--text-xs)", color: "var(--fg-subtle)" }}>
            {company}. {location}
          </div>
        </div>
        <div style={{ textAlign: "right", flex: "none" }}>
          <div
            style={{
              fontWeight: 600,
              fontSize: "var(--text-md)",
              letterSpacing: "var(--tracking-tight)",
              fontVariantNumeric: "tabular-nums",
            }}
          >
            {match == null ? "New" : `${match}%`}
          </div>
          <div style={{ fontSize: "var(--text-2xs)", color: "var(--fg-subtle)" }}>
            {match == null ? "not scored" : "match"}
          </div>
        </div>
      </div>

      <div
        style={{
          display: "flex",
          gap: 12,
          fontSize: "var(--text-xs)",
          color: "var(--fg-muted)",
          flexWrap: "wrap",
        }}
      >
        {[salary, ats, posted].filter(Boolean).map((x, i) => (
          <React.Fragment key={i}>
            {i > 0 && <span style={{ color: "var(--border-strong)" }}>|</span>}
            <span>{x}</span>
          </React.Fragment>
        ))}
      </div>

      {reasons.length > 0 && (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 4,
            fontSize: "var(--text-xs)",
            color: "var(--fg-muted)",
            borderTop: "1px solid var(--border)",
            paddingTop: 10,
          }}
        >
          {reasons.map((r, i) => (
            <div
              key={i}
              style={{
                display: "flex",
                gap: 6,
                color: r.startsWith("-") || r.startsWith("?") ? "var(--fg-subtle)" : "inherit",
              }}
            >
              <span style={{ width: 12, flex: "none" }}>
                {r.startsWith("-") ? "-" : r.startsWith("?") ? "?" : "+"}
              </span>
              <span>{r.replace(/^[-+?]\s*/, "")}</span>
            </div>
          ))}
        </div>
      )}

      <div style={{ display: "flex", gap: 8, marginTop: "auto" }}>
        <Button variant="primary" size="sm" style={{ flex: 1 }} onClick={onApply}>
          Apply
        </Button>
        <Button size="sm" onClick={onSave}>
          Save
        </Button>
        <Button variant="ghost" size="sm" onClick={onSkip}>
          Skip
        </Button>
      </div>
    </article>
  );
}
