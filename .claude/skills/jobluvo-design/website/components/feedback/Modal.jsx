import React from "react";
export function Modal({ open = true, title, children, cancelLabel = "Cancel", confirmLabel = "Confirm", onCancel, onConfirm, confirm, cancel }) {
  if (!open) return null;
  const btn = (primary, label, onClick) => <button onClick={onClick} style={{ height: "var(--control-md)", padding: "0 12px", border: `1px solid ${primary ? "var(--accent)" : "var(--border-strong)"}`, borderRadius: "var(--radius-sm)", background: primary ? "var(--accent)" : "var(--surface-0)", color: primary ? "var(--fg-inverse)" : "var(--fg)", fontWeight: 500, fontFamily: "inherit", fontSize: "var(--text-sm)", cursor: "pointer" }}>{label}</button>;
  return (
    <div onClick={onCancel} style={{ position: "fixed", inset: 0, background: "rgba(17,18,20,.32)", display: "grid", placeItems: "center", zIndex: 50, fontFamily: "var(--font-sans)" }}>
      <div onClick={e => e.stopPropagation()} style={{ width: 440, maxWidth: "calc(100% - 48px)", background: "var(--surface-0)", border: "1px solid var(--border-strong)", borderRadius: "var(--radius-lg)", display: "flex", flexDirection: "column" }}>
        <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "var(--text-md)", fontWeight: 500 }}>{title}<button onClick={onCancel} aria-label="Close" style={{ width: 28, height: 28, border: 0, borderRadius: "var(--radius-sm)", background: "transparent", color: "var(--fg-subtle)", cursor: "pointer", fontSize: 16 }}>×</button></div>
        <div style={{ padding: 20, color: "var(--fg-muted)", fontSize: "var(--text-base)", lineHeight: "21px", textWrap: "pretty" }}>{children}</div>
        <div style={{ padding: "12px 20px", borderTop: "1px solid var(--border)", display: "flex", justifyContent: "flex-end", gap: 8 }}>{cancel || btn(false, cancelLabel, onCancel)}{confirm || btn(true, confirmLabel, onConfirm)}</div>
      </div>
    </div>
  );
}
