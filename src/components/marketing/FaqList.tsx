"use client";

import * as React from "react";
import type { Faq } from "@/lib/marketing/faqs";

/** Accordion. One row per question, plus and minus marker, no colour. */
export function FaqList({ items }: { items: Faq[] }) {
  const [open, setOpen] = React.useState<number | null>(null);

  return (
    <div className="faq">
      {items.map(([q, a], i) => (
        <div key={q} className={`qa${open === i ? " open" : ""}`}>
          <button
            type="button"
            aria-expanded={open === i}
            onClick={() => setOpen(open === i ? null : i)}
          >
            {q}
          </button>
          {open === i && <div className="a">{a}</div>}
        </div>
      ))}
    </div>
  );
}
