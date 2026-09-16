import Link from "next/link";
import { Button } from "@/components/core/Button";

/** The closing call to action band. Inverse surface, one action. */
export function Band({
  title,
  body,
  action,
  href = "/signup",
}: {
  title: string;
  body: string;
  action: string;
  href?: string;
}) {
  return (
    <section className="m-section">
      <div className="wrap">
        <div className="band reveal">
          <h2>{title}</h2>
          <p>{body}</p>
          <Link href={href}>
            <Button size="lg" style={{ background: "var(--surface-0)", borderColor: "var(--surface-0)" }}>
              {action}
            </Button>
          </Link>
        </div>
      </div>
    </section>
  );
}
