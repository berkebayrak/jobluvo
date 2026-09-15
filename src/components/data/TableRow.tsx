"use client";

import * as React from "react";
import { useHover } from "../useHover";

export interface TableRowProps {
  /** CSS grid-template-columns shared by every row in the table */
  columns: string;
  cells: React.ReactNode[];
  header?: boolean;
  selected?: boolean;
  density?: "compact" | "regular";
  onClick?: () => void;
}

/**
 * One grid row. Compact is 32px, regular 40px. Header is 11px uppercase on
 * surface-header. No zebra striping, no vertical lines.
 */
export function TableRow({
  columns,
  cells,
  header = false,
  selected = false,
  density = "compact",
  onClick,
}: TableRowProps) {
  const [{ hover }, h] = useHover();
  const pad = header ? 0 : density === "compact" ? 6 : 10;

  return (
    <div
      onClick={onClick}
      {...h}
      style={{
        display: "grid",
        gridTemplateColumns: columns,
        alignItems: "center",
        padding: `${pad}px 16px`,
        minHeight: header
          ? 32
          : density === "compact"
            ? "var(--row-compact)"
            : "var(--row-regular)",
        borderBottom: header
          ? "1px solid var(--border-strong)"
          : "1px solid var(--border)",
        background: header
          ? "var(--surface-header)"
          : selected
            ? "var(--surface-2)"
            : hover && onClick
              ? "var(--surface-1)"
              : "var(--surface-0)",
        cursor: onClick ? "pointer" : "default",
        fontFamily: "var(--font-sans)",
        fontSize: header ? "var(--text-2xs)" : "var(--text-sm)",
        lineHeight: "var(--leading-sm)",
        color: "var(--fg)",
        letterSpacing: header ? "var(--tracking-wide)" : 0,
        textTransform: header ? "uppercase" : "none",
      }}
    >
      {cells.map((c, i) => (
        <span
          key={i}
          style={{
            minWidth: 0,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
            paddingRight: 12,
          }}
        >
          {c}
        </span>
      ))}
    </div>
  );
}
