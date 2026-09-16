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

  React.useEffect(() => {
    function sync() {
      const id = window.location.hash.replace("#", "");
      setPicked(SECTIONS.includes(id) ? id : null);
    }
    window.addEventListener("hashchange", sync);
    return () => window.removeEventListener("hashchange", sync);
  }, []);

  function isOn(n: (typeof nav)[number]) {
    if (n.section) return onHome && picked === n.section;
    return pathname.startsWith(n.href);
  }

  return (
    <nav className="m-nav">
      <div className="wrap">
        <Link
          href="/"
          onClick={() => setPicked(null)}
          style={{ marginRight: 24, display: "flex", alignItems: "center" }}
        >
          <span className="wordmark">Jobluvo</span>
        </Link>
        <div className="links">
          {nav.map((n) => (
            <Link
              key={n.href}
              href={n.href}
              onClick={() => setPicked(n.section ?? null)}
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
      </div>
    </nav>
  );
}
