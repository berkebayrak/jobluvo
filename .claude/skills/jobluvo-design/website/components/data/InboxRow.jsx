import React from "react";
import { useHover } from "../useHover.js";
import { StatusTag } from "./StatusTag.jsx";
export function InboxRow({ from, logo, subject, preview, when, status, unread = false, selected = false, onClick }) {
  const [{ hover }, h] = useHover();
  const w = unread ? 500 : 400;
  return (
    <div onClick={onClick} {...h} style={{ display: "flex", gap: 10, padding: "10px 12px", borderBottom: "1px solid var(--border)", borderLeft: `2px solid ${selected ? "var(--accent)" : "transparent"}`, background: selected ? "var(--surface-2)" : hover ? "var(--surface-1)" : "var(--surface-0)", cursor: "pointer", fontFamily: "var(--font-sans)", fontSize: "var(--text-sm)", lineHeight: "var(--leading-sm)" }}>
      {logo && <img src={logo} alt="" style={{ width: 24, height: 24, borderRadius: "var(--radius-sm)", border: "1px solid var(--border)", objectFit: "contain", flex: "none", marginTop: 2 }} />}
      <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 2 }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}><span style={{ fontWeight: w, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{from}</span><span style={{ fontSize: "var(--text-2xs)", color: "var(--fg-subtle)", whiteSpace: "nowrap" }}>{when}</span></div>
        <div style={{ fontWeight: w, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{subject}</div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>{status && <StatusTag status={status} size="sm" />}<span style={{ fontSize: "var(--text-xs)", color: "var(--fg-subtle)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{preview}</span></div>
      </div>
    </div>
  );
}
