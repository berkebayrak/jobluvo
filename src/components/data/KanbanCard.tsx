"use client";

import * as React from "react";
import { useHover } from "../useHover";

export interface KanbanCardProps {
  company: string;
  /** Logo.dev image URL */
  logo?: string;
  title: string;
  match?: number;
  /** Last event, one short clause */
  event?: string;
  date?: string;
}

/**
 * Tracker card. The column it sits in is its status, so it carries no tag.
 * Columns sit on surface-1. Hover turns the card border black.
 */
export function KanbanCard({
  company,
  logo,
  title,
  match,
  event,
  date,
}: KanbanCardProps) {
  const [{ hover }, h] = useHover();

  return (
    <article
      {...h}
      style={{
        background: "var(--surface-0)",
        border: `1px solid ${hover ? "var(--accent)" : "var(--border)"}`,
        borderRadius: "var(--radius-sm)",
        padding: "10px 12px",
        display: "flex",
        flexDirection: "column",
        gap: 6,
        cursor: "grab",
        fontFamily: "var(--font-sans)",
        fontSize: "var(--text-sm)",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        {logo && (
          // eslint-disable-next-line @next/next/no-img-element -- remote Logo.dev URLs, no loader configured
          <img
            src={logo}
            alt=""
            style={{ width: 16, height: 16, borderRadius: 3, objectFit: "contain" }}
          />
        )}
        <span
          style={{
            fontSize: "var(--text-xs)",
            color: "var(--fg-muted)",
            flex: 1,
            minWidth: 0,
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {company}
        </span>
        {match != null && (
          <span
            style={{
              fontSize: "var(--text-2xs)",
              color: "var(--fg-subtle)",
              fontVariantNumeric: "tabular-nums",
            }}
          >
            {match}%
          </span>
        )}
      </div>
      <div style={{ fontWeight: 500, lineHeight: "18px" }}>{title}</div>
      <div
        style={{
          fontSize: "var(--text-2xs)",
          color: "var(--fg-subtle)",
          display: "flex",
          justifyContent: "space-between",
          gap: 8,
        }}
      >
        <span
          style={{
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {event}
        </span>
        <span style={{ whiteSpace: "nowrap" }}>{date}</span>
      </div>
    </article>
  );
}
