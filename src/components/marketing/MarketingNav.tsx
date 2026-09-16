"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Button } from "@/components/core/Button";
import { nav } from "@/lib/marketing/content";

/**
 * Marks the tab whose section is currently in view. How it works, Pricing and
 * FAQ are sections of the home page, so there is no pathname to read; Blog is
 * the only tab that matches on the route.
 */
function useActiveSection(enabled: boolean) {
  const [active, setActive] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!enabled) return;
    const sections = nav
      .filter((n) => n.section)
      .map((n) => document.getElementById(n.section!))
      .filter((el): el is HTMLElement => el !== null);

    if (sections.length === 0) return;

    const seen = new Map<string, number>();
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => seen.set(e.target.id, e.intersectionRatio));
        let best: string | null = null;
        let bestRatio = 0;
        seen.forEach((ratio, id) => {
          if (ratio > bestRatio) {
            bestRatio = ratio;
            best = id;
          }
        });
        setActive(bestRatio > 0 ? best : null);
      },
      { threshold: [0, 0.15, 0.4, 0.75], rootMargin: "-64px 0px 0px 0px" },
    );

    sections.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, [enabled]);

  // Derived rather than cleared in the effect, so leaving the home page does
  // not need a state write.
  return enabled ? active : null;
}

export function MarketingNav() {
  const pathname = usePathname();
  const onHome = pathname === "/";
  const activeSection = useActiveSection(onHome);

  function isOn(n: (typeof nav)[number]) {
    if (n.section) return onHome && activeSection === n.section;
    return pathname.startsWith(n.href);
  }

  return (
    <nav className="m-nav">
      <div className="wrap">
        <Link href="/" style={{ marginRight: 24, display: "flex", alignItems: "center" }}>
          <span className="wordmark">Jobluvo</span>
        </Link>
        <div className="links">
          {nav.map((n) => (
            <Link key={n.href} href={n.href} className={isOn(n) ? "on" : undefined}>
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
