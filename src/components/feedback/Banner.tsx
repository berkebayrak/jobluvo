import * as React from "react";

export interface BannerProps {
  title: string;
  body?: string;
  /** Usually a primary sm Button */
  primary?: React.ReactNode;
  /** Usually a secondary sm Button labelled Later */
  secondary?: React.ReactNode;
  /** attention draws a black border, info a grey one */
  tone?: "attention" | "info";
}

/**
 * One line banner for things that need the user. Never a coloured fill.
 * Only one banner per screen. If nothing needs the user, show nothing.
 */
export function Banner({ title, body, primary, secondary, tone = "attention" }: BannerProps) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        border: `1px solid ${tone === "attention" ? "var(--accent)" : "var(--border)"}`,
        borderRadius: "var(--radius-md)",
        padding: "12px 16px",
        background: "var(--surface-0)",
        fontFamily: "var(--font-sans)",
        fontSize: "var(--text-sm)",
        lineHeight: "var(--leading-sm)",
      }}
    >
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        style={{ flex: "none" }}
        aria-hidden="true"
      >
        <circle cx="12" cy="12" r="9" />
        <path d="M12 8v4M12 16h.01" />
      </svg>
      <div style={{ flex: 1, minWidth: 0 }}>
        <span style={{ fontWeight: 500 }}>{title}</span>{" "}
        <span style={{ color: "var(--fg-muted)" }}>{body}</span>
      </div>
      {primary}
      {secondary}
    </div>
  );
}
