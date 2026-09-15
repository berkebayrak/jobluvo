"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Button } from "@/components/core/Button";
import { nav } from "@/lib/marketing/content";

export function MarketingNav() {
  const pathname = usePathname();

  return (
    <nav className="m-nav">
      <div className="wrap">
        <Link href="/" style={{ marginRight: 24, display: "flex", alignItems: "center" }}>
          <span className="wordmark">Jobluvo</span>
        </Link>
        <div className="links">
          {nav.map((n) => (
            <Link
              key={n.href}
              href={n.href}
              className={pathname.startsWith(n.href) ? "on" : undefined}
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
