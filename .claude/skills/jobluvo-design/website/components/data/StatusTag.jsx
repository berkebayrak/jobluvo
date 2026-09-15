import React from "react";
const CIRCLE = "M5 1a4 4 0 1 0 0 8a4 4 0 1 0 0-8", X = "M2.5 2.5l5 5M7.5 2.5l-5 5";
export const STATUS = {
  submitted: { label: "Submitted", d: CIRCLE, f: "", tier: "default" },
  needs: { label: "Needs you", d: CIRCLE, f: "M4.4 2.6h1.2v3.2H4.4zM4.4 6.6h1.2v1.2H4.4z", tier: "attention" },
  held: { label: "Held for review", d: "M3.5 2.5v5M6.5 2.5v5", f: "", tier: "attention" },
  verifying: { label: "Verifying", d: CIRCLE, f: "M5 1a4 4 0 0 1 0 8z", tier: "default" },
  failed: { label: "Failed", d: X, f: "", tier: "danger" },
  applied: { label: "Applied", d: CIRCLE, f: CIRCLE, tier: "default" },
  replied: { label: "Replied", d: "M6 2.5L3 5l3 2.5M3 5h4.5", f: "", tier: "default" },
  interviewing: { label: "Interviewing", d: "M3.5 2.5a2.5 2.5 0 1 0 0 5a2.5 2.5 0 1 0 0-5M6.5 2.5a2.5 2.5 0 1 0 0 5a2.5 2.5 0 1 0 0-5", f: "", tier: "strong" },
  offer: { label: "Offer", d: "M2.5 5.2l1.8 1.8L7.7 3.5", f: "", tier: "inverse" },
  rejected: { label: "Rejected", d: X, f: "", tier: "muted" },
  ghosted: { label: "Ghosted", d: CIRCLE, f: "", tier: "ghost" },
};
const TIER = {
  default: { border: "var(--border-strong)", bg: "var(--surface-0)", color: "var(--fg-muted)", dash: "solid" },
  strong: { border: "var(--accent)", bg: "var(--surface-0)", color: "var(--fg)", dash: "solid" },
  attention: { border: "var(--accent)", bg: "var(--accent)", color: "var(--fg-inverse)", dash: "solid" },
  inverse: { border: "var(--accent)", bg: "var(--accent)", color: "var(--fg-inverse)", dash: "solid" },
  danger: { border: "var(--border-strong)", bg: "var(--surface-0)", color: "var(--danger)", dash: "solid" },
  muted: { border: "var(--border)", bg: "var(--surface-0)", color: "var(--fg-subtle)", dash: "solid" },
  ghost: { border: "var(--border-strong)", bg: "var(--surface-0)", color: "var(--fg-subtle)", dash: "dashed" },
};
export function StatusTag({ status = "submitted", size = "md" }) {
  const s = STATUS[status] || STATUS.submitted, t = TIER[s.tier];
  const h = size === "sm" ? 18 : 20, fs = size === "sm" ? 10.5 : 11;
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 6, height: h, padding: "0 7px 0 6px", borderRadius: "var(--radius-xs)", fontSize: fs, lineHeight: 1, fontWeight: 500, whiteSpace: "nowrap", fontFamily: "var(--font-sans)", border: `1px ${t.dash} ${t.border}`, background: t.bg, color: t.color }}>
      <svg width="10" height="10" viewBox="0 0 10 10"><path d={s.d} fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" strokeDasharray={s.tier === "ghost" ? "1.6 1.6" : "0"} /><path d={s.f} fill="currentColor" /></svg>
      {s.label}
    </span>
  );
}
