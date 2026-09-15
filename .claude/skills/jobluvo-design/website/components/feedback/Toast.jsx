import React from "react";
export function Toast({ text, actionLabel, onAction }) {
  return (
    <div style={{ position: "fixed", left: "50%", bottom: 24, transform: "translateX(-50%)", background: "var(--surface-inverse)", color: "var(--fg-inverse)", borderRadius: "var(--radius-md)", padding: "10px 12px 10px 14px", display: "flex", alignItems: "center", gap: 12, fontSize: "var(--text-sm)", lineHeight: "var(--leading-sm)", zIndex: 60, fontFamily: "var(--font-sans)", whiteSpace: "nowrap" }}>
      <span>{text}</span>
      {actionLabel && <button onClick={onAction} style={{ border: 0, background: "transparent", color: "var(--jl-grey-400)", fontSize: "var(--text-xs)", padding: "0 4px", cursor: "pointer", fontFamily: "inherit" }}>{actionLabel}</button>}
    </div>
  );
}
