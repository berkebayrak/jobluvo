"use client";

import * as React from "react";
import { useRouter, usePathname } from "next/navigation";
import { TopNav } from "@/components/navigation/TopNav";
import { Toggle } from "@/components/core/Toggle";
import { AgentPanel } from "@/components/app/AgentPanel";
import { DensityProvider, useDensity } from "@/components/app/density";

/** Tabs never scroll. Profile and Settings live behind the avatar. */
const TABS: { label: string; href: string }[] = [
  { label: "Dashboard", href: "/dashboard" },
  { label: "Jobs", href: "/jobs" },
  { label: "Auto Apply", href: "/auto-apply" },
  { label: "Tracker", href: "/tracker" },
  { label: "Inbox", href: "/inbox" },
];

function Shell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [menu, setMenu] = React.useState(false);
  const { density, setDensity } = useDensity();
  const menuRef = React.useRef<HTMLSpanElement>(null);

  // The account menu closes on Escape and on a click outside it.
  React.useEffect(() => {
    function onPointerDown(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenu(false);
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setMenu(false);
    }
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKey);
    };
  }, []);

  const active = TABS.find((t) => pathname.startsWith(t.href))?.label ?? "Dashboard";

  return (
    <div className="shell">
      <TopNav
        href="/dashboard"
        tabs={TABS.map((t) => t.label)}
        active={active}
        onSelect={(label) => {
          const tab = TABS.find((t) => t.label === label);
          if (tab) router.push(tab.href);
        }}
        right={
          <>
            <span
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                fontSize: "var(--text-xs)",
                color: "var(--fg-subtle)",
              }}
            >
              Regular rows
              <Toggle
                on={density === "regular"}
                onChange={(on) => setDensity(on ? "regular" : "compact")}
              />
            </span>
            <span ref={menuRef} style={{ position: "relative" }}>
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
                    // Log out leaves the product for the marketing home. A
                    // placeholder until real auth exists: there is no session
                    // to end, so it only navigates. A rule separates it from
                    // the two that stay inside the product.
                    { label: "Log out", href: "/", separated: true },
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
                        borderTop: m.separated ? "1px solid var(--border)" : undefined,
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

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <DensityProvider>
      <Shell>{children}</Shell>
    </DensityProvider>
  );
}
