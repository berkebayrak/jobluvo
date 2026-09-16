"use client";

import * as React from "react";
import Link from "next/link";
import { Check, X } from "lucide-react";
import { Button } from "@/components/core/Button";
import {
  equivalent,
  periods,
  plans,
  prices,
  saveNote,
  type Period,
} from "@/lib/marketing/pricing";

function Feature({
  text,
  provisional,
  no,
  strong,
}: {
  text: string;
  provisional?: string;
  no?: boolean;
  strong?: boolean;
}) {
  const [before, after] = provisional ? text.split("{n}") : [text, ""];
  return (
    <li className={no ? "n" : undefined}>
      <i className="mk" aria-hidden>
        {no ? (
          <X size={11} strokeWidth={1.5} absoluteStrokeWidth />
        ) : (
          <Check size={11} strokeWidth={1.5} absoluteStrokeWidth />
        )}
      </i>
      <span>
        {provisional ? (
          <>
            {before}
            <b data-provisional>{provisional}</b>
            {after}
          </>
        ) : strong ? (
          <b>{text}</b>
        ) : (
          text
        )}
      </span>
    </li>
  );
}

export function PricingBlock() {
  const [period, setPeriod] = React.useState<Period>("monthly");
  const d = prices[period];

  return (
    <>
      <div className="period-wrap">
        <div className="period">
          {periods.map((p) => (
            <button
              key={p.key}
              type="button"
              className={p.key === period ? "on" : undefined}
              onClick={() => setPeriod(p.key)}
            >
              {p.label}
              {p.note && <small>{p.note}</small>}
            </button>
          ))}
        </div>
        <div className="save-note">
          <svg viewBox="0 0 90 50" aria-hidden="true">
            <path
              d="M86 6 C72 3, 56 9, 50 21 C45 30, 53 38, 60 33 C67 28, 58 19, 50 24 C41 29, 30 36, 14 37"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
            />
            <path
              d="M20 30 L11 37 L20 43"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          <span>{saveNote(period)}</span>
        </div>
      </div>

      <div className="plan-grid">
        {plans.map((plan) => (
          <div key={plan.key} className={`plan${plan.hot ? " hot" : ""} reveal`}>
            {plan.hot && <div className="badge-pop">Most popular</div>}
            <div className="pn">{plan.name}</div>
            <p className="pd">{plan.description}</p>
            <div className="price">
              <span className="cur">$</span>
              <b>{d[plan.key]}</b>
              <span className="per">{d.per}</span>
            </div>
            <div className="eq">{equivalent(plan.key, period)}</div>
            <Link href="/signup" className="choose">
              <Button
                size="lg"
                style={
                  plan.hot
                    ? {
                        /* No background here: the Button's own hover tint stays. */
                        width: "100%",
                        fontSize: 15,
                        color: "var(--fg)",
                        borderColor: "var(--surface-0)",
                      }
                    : { width: "100%", fontSize: 15, borderColor: "var(--accent)" }
                }
              >
                Choose {plan.name}
              </Button>
            </Link>
            <ul className="feat">
              {plan.features.map((f) => (
                <Feature key={f.text} {...f} />
              ))}
            </ul>
          </div>
        ))}
      </div>

      <p className="free-note">
        <b>Every account starts with 25 free applications</b> using the full apply
        workflow. Maya and Daniel are available on paid plans. Prices in USD. Cancel
        anytime.
      </p>
    </>
  );
}
