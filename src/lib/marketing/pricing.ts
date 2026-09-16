/**
 * Plans and prices, ported from the delivered marketing
 * site (.claude/skills/jobluvo-design/uploads/05-Website.html) and matching
 * design/docs/01-Product-BRD.md.
 *
 * Allowances are provisional. Do not publish them as commitments.
 */

export type Period = "monthly" | "quarterly" | "annual";
export type PlanKey = "starter" | "pro" | "max";

export interface PeriodPrices {
  starter: number;
  pro: number;
  max: number;
  per: string;
  months: number;
}

export const prices: Record<Period, PeriodPrices> = {
  monthly: { starter: 16, pro: 35, max: 89, per: "/month", months: 1 },
  quarterly: { starter: 42, pro: 74, max: 199, per: "/3 months", months: 3 },
  annual: { starter: 149, pro: 269, max: 699, per: "/year", months: 12 },
};

export const periods: { key: Period; label: string; note?: string }[] = [
  { key: "monthly", label: "Monthly" },
  { key: "quarterly", label: "Quarterly", note: "save up to 30%" },
  { key: "annual", label: "Annual", note: "save up to 36%" },
];

export interface PlanFeature {
  /** provisional numbers are wrapped so they can be swapped for measured ones */
  text: string;
  provisional?: string;
  /** a feature the plan does not include */
  no?: boolean;
  strong?: boolean;
}

export interface Plan {
  key: PlanKey;
  name: string;
  description: string;
  hot?: boolean;
  features: PlanFeature[];
}

export const plans: Plan[] = [
  {
    key: "starter",
    name: "Starter",
    description: "Enough for a real job search.",
    features: [
      { text: "Up to {n} applications a month", provisional: "750" },
      { text: "Tailored resumes and cover letters" },
      { text: "Swipe and List views" },
      { text: "Maya and Daniel" },
      { text: "Jobluvo inbox and address" },
      { text: "Auto Apply lanes", no: true },
      { text: "Review before submit", no: true },
    ],
  },
  {
    key: "pro",
    name: "Pro",
    description: "For a serious, full time search.",
    hot: true,
    features: [
      { text: "Up to {n} applications a month", provisional: "1,750" },
      { text: "Tailored resumes and cover letters" },
      { text: "Swipe and List views" },
      { text: "Maya and Daniel" },
      { text: "Jobluvo inbox and address" },
      { text: "Priority on fresh jobs" },
      { text: "Auto Apply lanes", no: true },
    ],
  },
  {
    key: "max",
    name: "Max",
    description: "Hit every match before anyone else.",
    features: [
      { text: "Up to {n} applications a month", provisional: "5,000" },
      { text: "Everything in Pro" },
      { text: "Auto Apply with up to 5 lanes", strong: true },
      { text: "Review before submit" },
      { text: "Standing instructions per lane" },
      { text: "Agent tuning of lanes" },
      { text: "Priority support" },
    ],
  },
];

/** Per month equivalent and saving against paying monthly. */
export function equivalent(key: PlanKey, period: Period): string {
  const d = prices[period];
  if (d.months === 1) return "billed monthly";
  const perMonth = d[key] / d.months;
  const full = prices.monthly[key] * d.months;
  const save = Math.round((1 - d[key] / full) * 100);
  return `about $${perMonth.toFixed(2).replace(/\.00$/, "")} a month, ${save}% less than monthly`;
}

export function saveNote(period: Period): string {
  return period === "annual"
    ? "Save up to 36%"
    : period === "quarterly"
      ? "Save up to 30%"
      : "Save with annual";
}
