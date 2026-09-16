import Link from "next/link";
import { nav } from "@/lib/marketing/content";

export function MarketingFooter() {
  return (
    <footer className="m-footer">
      <div className="wrap">
        <div className="frow">
          <Link href="/">
            <span className="wordmark">Jobluvo</span>
          </Link>
          <div className="flinks">
            {nav.map((n) => (
              <Link key={n.href} href={n.href}>
                {n.label}
              </Link>
            ))}
          </div>
        </div>
        <div className="bottom">
          <span>2026 Jobluvo. All rights reserved.</span>
        </div>
      </div>
    </footer>
  );
}
