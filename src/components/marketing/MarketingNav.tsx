"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Button } from "@/components/core/Button";
import { nav } from "@/lib/marketing/content";

const SECTIONS = nav.map((n) => n.section).filter(Boolean) as string[];

export function MarketingNav() {
  const pathname = usePathname();
  const onHome = pathname === "/";

  /**
   * Which section tab is marked, if any. Nothing is marked when the page
   * opens; a tab lights up once the reader picks it. Back and forward keep up
   * through hashchange.
   */
  const [picked, setPicked] = React.useState<string | null>(null);
  const [menu, setMenu] = React.useState(false);

  React.useEffect(() => {
    function sync() {
      const id = window.location.hash.replace("#", "");
      setPicked(SECTIONS.includes(id) ? id : null);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setMenu(false);
    }
    window.addEventListener("hashchange", sync);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("hashchange", sync);
      window.removeEventListener("keydown", onKey);
    };
  }, []);

  function isOn(n: (typeof nav)[number]) {
    if (n.section) return onHome && picked === n.section;
    return pathname.startsWith(n.href);
  }

  function pick(n: (typeof nav)[number]) {
    setPicked(n.section ?? null);
    setMenu(false);
  }

  return (
    <nav className="m-nav">
      <div className="wrap">
        <Link
          href="/"
          onClick={() => {
            setPicked(null);
            setMenu(false);
          }}
          style={{ marginRight: 24, display: "flex", alignItems: "center" }}
        >
          <span className="wordmark">Jobluvo</span>
        </Link>

        <div className="links">
          {nav.map((n) => (
            <Link
              key={n.href}
              href={n.href}
              onClick={() => pick(n)}
              className={isOn(n) ? "on" : undefined}
            >
              {n.label}
            </Link>
          ))}
        </div>

        <span className="spacer" />

        <div className="right">
          <Link href="/signin">
            <Button variant="ghost">Sign in</Button>
          </Link>
          <Link href="/signup">
            <Button variant="primary">Start free</Button>
          </Link>
        </div>

        {/* Below 1000px the centred links are hidden and this opens them. */}
        <button
          type="button"
          className="burger"
          aria-label={menu ? "Close menu" : "Open menu"}
          aria-expanded={menu}
          onClick={() => setMenu((m) => !m)}
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            aria-hidden="true"
          >
            {menu ? (
              <path d="M6 6l12 12M18 6L6 18" />
            ) : (
              <path d="M4 7h16M4 12h16M4 17h16" />
            )}
          </svg>
        </button>
      </div>

      {menu && (
        <div className="m-menu">
          {nav.map((n) => (
            <Link
              key={n.href}
              href={n.href}
              onClick={() => pick(n)}
              className={isOn(n) ? "on" : undefined}
            >
              {n.label}
            </Link>
          ))}
        </div>
      )}
    </nav>
  );
}
