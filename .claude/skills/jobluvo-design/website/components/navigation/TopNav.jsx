import React from "react";
export function TopNav({ tabs = [], active, onSelect, right }) {
  return (
    <header style={{ height: "var(--topnav-height)", display: "flex", alignItems: "center", gap: 24, padding: "0 24px", borderBottom: "1px solid var(--border)", background: "var(--surface-0)", fontFamily: "var(--font-sans)", fontSize: "var(--text-sm)" }}>
      <span style={{ fontWeight: 600, letterSpacing: "var(--tracking-wordmark)", flex: "none" }}>JOBLUVO</span>
      <nav style={{ display: "flex", gap: 2, height: "100%" }}>
        {tabs.map(t => { const on = t === active; return <button key={t} onClick={() => onSelect && onSelect(t)} style={{ height: "100%", padding: "0 12px", border: 0, borderBottom: `1px solid ${on ? "var(--accent)" : "transparent"}`, marginBottom: -1, background: "transparent", color: on ? "var(--fg)" : "var(--fg-muted)", fontWeight: 500, fontFamily: "inherit", fontSize: "inherit", cursor: "pointer", whiteSpace: "nowrap" }}>{t}</button>; })}
      </nav>
      <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 12, flex: "none", whiteSpace: "nowrap" }}>{right}</div>
    </header>
  );
}
