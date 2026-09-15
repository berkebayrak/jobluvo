import * as React from "react";

export interface CardProps {
  title?: string;
  /** Right side of the header, usually a ghost Button */
  action?: React.ReactNode;
  /** false when the body is a list of rows that own their padding */
  padded?: boolean;
  children?: React.ReactNode;
  style?: React.CSSProperties;
}

/** Bordered container with optional header. No shadow. Cards never nest. */
export function Card({ title, action, children, padded = true, style }: CardProps) {
  return (
    <section
      style={{
        border: "1px solid var(--border)",
        borderRadius: "var(--radius-md)",
        background: "var(--surface-0)",
        overflow: "hidden",
        fontFamily: "var(--font-sans)",
        ...style,
      }}
    >
      {(title || action) && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "12px 16px",
            borderBottom: "1px solid var(--border-strong)",
            background: "var(--surface-header)",
            color: "var(--fg)",
            fontSize: "var(--text-sm)",
            lineHeight: "var(--leading-sm)",
          }}
        >
          <span style={{ fontWeight: 500 }}>{title}</span>
          {action}
        </div>
      )}
      <div style={{ padding: padded ? 16 : 0 }}>{children}</div>
    </section>
  );
}
