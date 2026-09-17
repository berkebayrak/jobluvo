import { and, eq, inArray } from "drizzle-orm";
import { dbPool } from "@/db/client";
import { profileFacts, sources, users } from "@/db/schema";
import { answerFact, authorizationFact, educationFact, employmentFact, preferenceFact, skillFact, sponsorshipFact } from "@/server/profile/facts";
import { DEMO_USER_EMAIL } from "@/server/user";
import { SEED_SOURCES } from "@/server/sources/registry";
import { ADAPTERS } from "@/server/sources/registry";

/*
 * Jack Miller's facts, entered as the user would enter them (origin user,
 * status confirmed). The preference, authorization and sponsorship facts
 * mirror the profile screen mock: targets the United States, will relocate
 * US wide, takes remote or on site, full time, is not authorized to work in
 * the US and needs sponsorship now and in future. Nothing here comes from
 * where Jack lives.
 *
 * The resume facts are seeded at the size extraction would produce from a
 * real ten year resume, four roles with their own bullet lines, two degrees,
 * about fifteen skills and two standing answers, because the profile block
 * is the stable half of every scoring prompt and its size is part of what
 * phase 0 measures. A tidy short profile would understate the cost.
 */
const JACK_FACTS = [
  {
    kind: "preference" as const,
    data: preferenceFact.parse({
      targetCountries: ["US"],
      relocation: "yes",
      remote: "remote_ok",
      employmentTypes: ["Full time"],
      earliestStart: "2026-11-01",
    }),
  },
  { kind: "authorization" as const, data: authorizationFact.parse({ country: "US", basis: "none", statedOn: "2026-09-17" }) },
  { kind: "sponsorship" as const, data: sponsorshipFact.parse({ now: true, future: true, statedOn: "2026-09-17" }) },
  {
    kind: "employment" as const,
    data: employmentFact.parse({
      company: "Arvento",
      title: "Head of Strategy and PMO",
      location: "Istanbul, Turkey",
      start: "2022-03",
      bullets: [
        "Lead the strategy and PMO function for a telematics company with USD 140M revenue, reporting to the CEO, with a team of four strategy managers and two analysts.",
        "Designed and ran a 3 year cost transformation program across 4 business units that reduced operating cost by 11 percent (USD 9.2M a year) against a 12 percent target.",
        "Own the annual planning cycle: targets, initiative portfolio and budget with product and finance, presented to the board twice a year.",
        "Built the company OKR system from scratch in 2023, now used by 38 teams, with a quarterly review cadence chaired by the executive committee.",
        "Screened 14 acquisition targets in fleet software and prepared the investment case for the one that closed in 2024 (USD 18M).",
        "Set up the PMO: stage gates, a single initiative register and a monthly steering pack that replaced 6 separate reporting formats.",
      ],
    }),
  },
  {
    kind: "employment" as const,
    data: employmentFact.parse({
      company: "Deloitte Turkey",
      title: "Senior Strategy Consultant",
      location: "Istanbul, Turkey",
      start: "2019-06",
      end: "2022-02",
      bullets: [
        "Delivered 9 growth and operating model projects for clients in telecoms, retail banking and consumer goods, as workstream lead on the last 5.",
        "Led the market entry study for a regional bank's SME lending product: sized a USD 1.1B addressable market and built the 5 year business case adopted by the client's board.",
        "Redesigned the operating model of a 2,400 person retail bank division, cutting management layers from 7 to 5 and consolidating 11 regional units into 6.",
        "Ran the pricing workstream of a telecom postpaid relaunch, with a conjoint study of 2,000 customers, that lifted ARPU 6 percent in the first year.",
        "Managed teams of 2 to 4 consultants and coached 6 analysts through the firm's case review process.",
      ],
    }),
  },
  {
    kind: "employment" as const,
    data: employmentFact.parse({
      company: "Turkcell",
      title: "Business Analyst, Pricing and Market Analysis",
      location: "Istanbul, Turkey",
      start: "2016-09",
      end: "2019-05",
      bullets: [
        "Built and maintained the pricing model for the consumer postpaid portfolio (12 plans, 20M subscribers), with monthly elasticity updates from usage data.",
        "Ran the quarterly competitor and market share analysis presented to the CMO, drawing on regulator filings, panel data and internal churn figures.",
        "Wrote the business cases for 3 tariff launches, one of which added 400k net subscribers in its first two quarters.",
        "Automated the weekly pricing dashboard in SQL and Power BI, removing about 12 hours of manual work a week for the team.",
      ],
    }),
  },
  {
    kind: "employment" as const,
    data: employmentFact.parse({
      company: "Garanti BBVA",
      title: "Analyst, Strategic Planning",
      location: "Istanbul, Turkey",
      start: "2014-08",
      end: "2016-08",
      bullets: [
        "Supported the annual strategic plan for the retail banking group: data gathering, branch network analysis and the financial model behind the 3 year targets.",
        "Prepared the monthly performance pack for the executive committee, covering 900 branches and 4 product lines.",
        "Modelled the branch consolidation scenarios that led to 60 closures with a 2 percent deposit loss against a 5 percent planning assumption.",
      ],
    }),
  },
  {
    kind: "education" as const,
    data: educationFact.parse({
      institution: "Koc University",
      degree: "MBA",
      field: "Executive MBA, part time",
      start: "2018-09",
      end: "2020-06",
      notes: ["Graduated with distinction. Capstone on subscription pricing in emerging markets."],
    }),
  },
  {
    kind: "education" as const,
    data: educationFact.parse({
      institution: "Bogazici University",
      degree: "BSc",
      field: "Industrial Engineering",
      start: "2010-09",
      end: "2014-06",
    }),
  },
  ...[
    ["Corporate strategy", 8, "Strategy lead at Arvento, consultant at Deloitte"],
    ["Annual planning and budgeting", 8, "Owns the planning cycle at Arvento"],
    ["Cost transformation programs", 4, "3 year program across 4 business units, USD 9.2M a year"],
    ["PMO leadership", 4, "Built the PMO at Arvento, stage gates and steering pack"],
    ["OKR frameworks", 3, "Company OKR system used by 38 teams"],
    ["Financial modelling", 10, "Business cases at every role since Garanti"],
    ["Board and executive reporting", 6, "Board presentations twice a year, executive committee packs"],
    ["M&A screening and investment cases", 3, "14 targets screened, one USD 18M deal closed"],
    ["Market sizing", 6, "USD 1.1B SME lending market study at Deloitte"],
    ["Pricing and elasticity analysis", 5, "Postpaid pricing model at Turkcell, conjoint study at Deloitte"],
    ["Operating model design", 3, "Retail bank division redesign at Deloitte"],
    ["Stakeholder management", 8, "CEO, CFO, board and client executives"],
    ["People management", 5, "Team of six at Arvento, teams of 2 to 4 at Deloitte"],
    ["SQL", 6, "Pricing dashboard and usage analysis at Turkcell"],
    ["Power BI and Excel", 10, "Dashboards and models at every role"],
    ["Presentation and storytelling", 8, "Client and board decks"],
  ].map(([name, years, evidence]) => ({ kind: "skill" as const, data: skillFact.parse({ name, years, evidence }) })),
  { kind: "answer" as const, data: answerFact.parse({ question: "Salary expectation", answer: "USD 150,000 to 175,000 base" }) },
  { kind: "answer" as const, data: answerFact.parse({ question: "Notice period", answer: "30 days" }) },
];

/**
 * Seeds the demo user, Jack's user entered facts and the source registry.
 * Every seed source is fetched first; one that does not answer with at least
 * one posting is skipped and listed, so the registry never carries a dead
 * board.
 *
 * Run with `npm run seed`. Safe to run again: it upserts, and a fact kind
 * Jack already has is left alone so edits made on the profile screen survive.
 */
async function main() {
  const db = dbPool();

  const [user] = await db
    .insert(users)
    .values({ name: "Jack Miller", email: DEMO_USER_EMAIL, jobluvoAddress: DEMO_USER_EMAIL })
    .onConflictDoNothing({ target: users.email })
    .returning();
  console.log(user ? `user created ${user.id}` : "user already present");

  const [jack] = await db.select({ id: users.id }).from(users).where(eq(users.email, DEMO_USER_EMAIL));
  const kinds = JACK_FACTS.map((f) => f.kind);
  const present = await db
    .select({ kind: profileFacts.kind })
    .from(profileFacts)
    .where(and(eq(profileFacts.userId, jack.id), inArray(profileFacts.kind, kinds)));
  const have = new Set(present.map((r) => r.kind));
  const missing = JACK_FACTS.filter((f) => !have.has(f.kind));
  if (missing.length) {
    await db.insert(profileFacts).values(missing.map((f) => ({ userId: jack.id, kind: f.kind, data: f.data, origin: "user" as const, status: "confirmed" as const })));
  }
  console.log(`facts: ${missing.length} added (${missing.map((f) => f.kind).join(", ") || "none"}), ${have.size} already present`);

  let added = 0;
  const skipped: string[] = [];
  for (const s of SEED_SOURCES) {
    const probe = { ...s, id: "", active: true, etag: null, lastAttemptAt: null, lastSuccessAt: null, lastStatus: null, lastError: null, consecutiveFailures: 0, jobCount: 0, boilerplateVersion: 0, boilerplate: [], createdAt: new Date() };
    try {
      const r = await ADAPTERS[s.family].fetch(probe, { detailBudget: 0, known: new Map() });
      const n = r.notModified ? -1 : r.postings.length;
      if (n <= 0) {
        skipped.push(`${s.family}/${s.tenant}: ${n === 0 ? "no postings" : "not modified without etag"}`);
        continue;
      }
      await db
        .insert(sources)
        .values({ family: s.family, tenant: s.tenant, companyName: s.companyName, companyDomain: s.companyDomain })
        .onConflictDoUpdate({
          target: [sources.family, sources.tenant],
          set: { companyName: s.companyName, companyDomain: s.companyDomain },
        });
      added += 1;
      console.log(`ok   ${s.family}/${s.tenant}  ${n} postings`);
    } catch (err) {
      skipped.push(`${s.family}/${s.tenant}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
  const total = await db.select({ id: sources.id }).from(sources).where(eq(sources.active, true));
  console.log(`\n${added} sources seeded, ${total.length} active in the registry`);
  if (skipped.length) console.log(`skipped:\n  ${skipped.join("\n  ")}`);
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
