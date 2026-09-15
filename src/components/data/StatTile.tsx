import * as React from "react";

export interface StatTileProps {
  label: string;
  value: string | number;
  /** One plain sentence of context under the number */
  note?: string;
  /** Drops the right divider on the last tile in a row */
  last?: boolean;
}

/**
 * Number tile for the dashboard row. Place four inside one bordered container.
 * No trend arrows, no sparkline, no colour: the note carries the meaning.
 */
export function StatTile({ label, value, note, last = false }: StatTileProps) {
  return (
    <div
      style={{
        padding: "16px 20px",
        borderRight: last ? 0 : "1px solid var(--border)",
        display: "flex",
        flexDirection: "column",
        gap: 6,
        fontFamily: "var(--font-sans)",
        background: "var(--surface-0)",
      }}
    >
      <div
        style={{
          fontSize: "var(--text-xs)",
          lineHeight: "var(--leading-xs)",
          color: "var(--fg-subtle)",
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontSize: "var(--text-2xl)",
          lineHeight: "var(--leading-2xl)",
          fontWeight: 600,
          letterSpacing: "var(--tracking-tight)",
          fontVariantNumeric: "tabular-nums",
        }}
      >
        {value}
      </div>
      {note && (
        <div
          style={{
            fontSize: "var(--text-xs)",
            lineHeight: "var(--leading-xs)",
            color: "var(--fg-muted)",
          }}
        >
          {note}
        </div>
      )}
    </div>
  );
}
