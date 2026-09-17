import * as React from "react";

export interface SwipeCardProps {
  company: string;
  logo?: string;
  title: string;
  location: string;
  posted?: string;
  salary?: string;
  ats?: string;
  /** Absent until the job has been scored; the ring stays empty and reads "New". */
  match?: number;
  reasons?: string[];
  /** Small print at the bottom, e.g. which resume will be tailored */
  footnote?: string;
  /** Animates the card off screen and shows the stamp */
  stamp?: "apply" | "skip" | null;
  style?: React.CSSProperties;
}

/**
 * 400x440 swipe card with match ring and APPLY / SKIP stamps. Setting stamp
 * throws the card off screen in 200ms. Reset it and swap the job after.
 */
export function SwipeCard({
  company,
  logo,
  title,
  location,
  posted,
  salary,
  ats,
  match,
  reasons = [],
  footnote,
  stamp = null,
  style,
}: SwipeCardProps) {
  const t =
    stamp === "apply"
      ? "translateX(140%) rotate(12deg)"
      : stamp === "skip"
        ? "translateX(-140%) rotate(-12deg)"
        : "none";

  return (
    <article
      style={{
        position: "relative",
        width: 400,
        height: 440,
        border: "1px solid var(--border-strong)",
        borderRadius: "var(--radius-lg)",
        background: "var(--surface-0)",
        padding: 20,
        display: "flex",
        flexDirection: "column",
        gap: 14,
        transition: "transform var(--duration-base) var(--ease)",
        transform: t,
        fontFamily: "var(--font-sans)",
        fontSize: "var(--text-sm)",
        lineHeight: "var(--leading-sm)",
        ...style,
      }}
    >
      <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
        {logo && (
          // eslint-disable-next-line @next/next/no-img-element -- remote Logo.dev URLs, no loader configured
          <img
            src={logo}
            alt={company}
            style={{
              width: 40,
              height: 40,
              borderRadius: "var(--radius-md)",
              border: "1px solid var(--border)",
              objectFit: "contain",
            }}
          />
        )}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 500, color: "var(--fg-muted)" }}>{company}</div>
          <div style={{ fontSize: "var(--text-xs)", color: "var(--fg-subtle)" }}>
            {location}. {posted}
          </div>
        </div>
        <div
          style={{
            width: 48,
            height: 48,
            borderRadius: "var(--radius-full)",
            display: "grid",
            placeItems: "center",
            background: `conic-gradient(var(--accent) ${(match ?? 0) * 3.6}deg, var(--surface-3) 0)`,
          }}
        >
          <span
            style={{
              width: 40,
              height: 40,
              borderRadius: "var(--radius-full)",
              background: "var(--surface-0)",
              display: "grid",
              placeItems: "center",
              fontWeight: 600,
              fontSize: "var(--text-xs)",
              fontVariantNumeric: "tabular-nums",
              whiteSpace: "nowrap",
            }}
          >
            {match == null ? "New" : `${match}%`}
          </span>
        </div>
      </div>

      <h2
        style={{
          margin: 0,
          fontSize: "var(--text-xl)",
          lineHeight: "var(--leading-xl)",
          fontWeight: 500,
          letterSpacing: "var(--tracking-tight)",
          textWrap: "pretty",
        }}
      >
        {title}
      </h2>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
        <div
          style={{
            background: "var(--surface-1)",
            borderRadius: "var(--radius-sm)",
            padding: "8px 10px",
          }}
        >
          <div style={{ fontSize: "var(--text-2xs)", color: "var(--fg-subtle)" }}>
            Salary
          </div>
          <div style={{ fontWeight: 500 }}>{salary}</div>
        </div>
        <div
          style={{
            background: "var(--surface-1)",
            borderRadius: "var(--radius-sm)",
            padding: "8px 10px",
          }}
        >
          <div style={{ fontSize: "var(--text-2xs)", color: "var(--fg-subtle)" }}>
            Applies via
          </div>
          <div style={{ fontWeight: 500 }}>{ats}</div>
        </div>
      </div>

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 6,
          color: "var(--fg-muted)",
        }}
      >
        {reasons.map((r, i) => (
          <div
            key={i}
            style={{
              display: "flex",
              gap: 8,
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

      {footnote && (
        <div
          style={{
            marginTop: "auto",
            fontSize: "var(--text-xs)",
            color: "var(--fg-subtle)",
            borderTop: "1px solid var(--border)",
            paddingTop: 10,
          }}
        >
          {footnote}
        </div>
      )}

      <div
        style={{
          position: "absolute",
          top: 70,
          right: 20,
          padding: "4px 10px",
          border: "2px solid var(--accent)",
          borderRadius: "var(--radius-sm)",
          fontWeight: 600,
          letterSpacing: ".1em",
          fontSize: "var(--text-base)",
          transform: "rotate(-10deg)",
          opacity: stamp === "apply" ? 1 : 0,
          transition: "opacity var(--duration-fast)",
        }}
      >
        APPLY
      </div>
      <div
        style={{
          position: "absolute",
          top: 70,
          left: 20,
          padding: "4px 10px",
          border: "2px solid var(--fg-subtle)",
          color: "var(--fg-subtle)",
          borderRadius: "var(--radius-sm)",
          fontWeight: 600,
          letterSpacing: ".1em",
          fontSize: "var(--text-base)",
          transform: "rotate(10deg)",
          opacity: stamp === "skip" ? 1 : 0,
          transition: "opacity var(--duration-fast)",
        }}
      >
        SKIP
      </div>
    </article>
  );
}
