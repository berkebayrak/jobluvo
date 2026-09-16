"use client";

import * as React from "react";
import { useRouter, usePathname } from "next/navigation";
import { TopNav } from "@/components/navigation/TopNav";
import { AgentPanel } from "@/components/app/AgentPanel";

/** Tabs never scroll. Profile and Settings live behind the avatar. */
const TABS: { label: string; href: string }[] = [
  { label: "Dashboard", href: "/dashboard" },
  { label: "Jobs", href: "/jobs" },
  { label: "Auto Apply", href: "/auto-apply" },
  { label: "Tracker", href: "/tracker" },
  { label: "Inbox", href: "/inbox" },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [menu, setMenu] = React.useState(false);

  const active = TABS.find((t) => pathname.startsWith(t.href))?.label ?? "Dashboard";

  return (
    <div className="shell">
      <TopNav
        tabs={TABS.map((t) => t.label)}
        active={active}
        onSelect={(label) => {
          const tab = TABS.find((t) => t.label === label);
          if (tab) router.push(tab.href);
        }}
        right={
          <>
            <span style={{ position: "relative" }}>
              <button
                onClick={() => setMenu((m) => !m)}
                aria-label="Account"
                style={{
                  height: 24,
                  padding: "0 12px",
                  display: "grid",
                  placeItems: "center",
                  border: "1px solid var(--border-strong)",
                  borderRadius: "var(--radius-xs)",
                  background: "var(--surface-0)",
                  fontSize: "var(--text-2xs)",
                  fontWeight: 500,
                  fontFamily: "inherit",
                  color: "var(--fg)",
                  cursor: "pointer",
                }}
              >
                JM
              </button>
              {menu && (
                <div
                  style={{
                    position: "absolute",
                    right: 0,
                    top: 30,
                    zIndex: 40,
                    background: "var(--surface-0)",
                    border: "1px solid var(--border-strong)",
                    borderRadius: "var(--radius-sm)",
                    minWidth: 180,
                    overflow: "hidden",
                  }}
                >
                  {[
                    { label: "Profile and resumes", href: "/profile" },
                    { label: "Settings", href: "/settings" },
                  ].map((m) => (
                    <button
                      key={m.href}
                      onClick={() => {
                        setMenu(false);
                        router.push(m.href);
                      }}
                      style={{
                        display: "block",
                        width: "100%",
                        textAlign: "left",
                        border: 0,
                        background: "transparent",
                        padding: "8px 12px",
                        fontSize: "var(--text-sm)",
                        fontFamily: "inherit",
                        color: "var(--fg)",
                        cursor: "pointer",
                      }}
                    >
                      {m.label}
                    </button>
                  ))}
                </div>
              )}
            </span>
          </>
        }
      />
      <div className="shell-body">
        <AgentPanel />
        <main className="app-main">
          <div className="app-inner">{children}</div>
        </main>
      </div>
    </div>
  );
}
