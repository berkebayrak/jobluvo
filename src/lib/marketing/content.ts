/**
 * Shared marketing content, ported verbatim from the delivered site
 * (.claude/skills/jobluvo-design/uploads/05-Website.html).
 */

export const nav = [
  { href: "/how-it-works", label: "How it works" },
  { href: "/pricing", label: "Pricing" },
  { href: "/blog", label: "Blog" },
  { href: "/faq", label: "FAQ" },
];

/** The "Applies on" strip. Files live in public/ats, copied from the handoff. */
export const atsLogos = [
  { alt: "Workday", file: "/ats/workday.png" },
  { alt: "Greenhouse", file: "/ats/greenhouse.png" },
  { alt: "Lever", file: "/ats/lever.png" },
  { alt: "Ashby", file: "/ats/ashby.png" },
  { alt: "iCIMS", file: "/ats/icims.png" },
  { alt: "SmartRecruiters", file: "/ats/smartrecruiters.png" },
  { alt: "Workable", file: "/ats/workable.png" },
  { alt: "Oracle", file: "/ats/oracle.png" },
  { alt: "ADP", file: "/ats/adp.png" },
  { alt: "Rippling", file: "/ats/rippling.png" },
  { alt: "BambooHR", file: "/ats/bamboohr.png" },
  { alt: "BreezyHR", file: "/ats/breezyhr.png" },
  { alt: "JazzHR", file: "/ats/jazzhr.png" },
  { alt: "Zoho Recruit", file: "/ats/zoho-recruit.png" },
  { alt: "Indeed", file: "/ats/indeed.png" },
  { alt: "Glassdoor", file: "/ats/glassdoor.png" },
];

/** Cards in the animated hero deck. */
export interface DemoJob {
  co: string;
  t: string;
  loc: string;
  p: number;
  s: string;
  l: string;
  w: string[];
  act: "apply" | "skip";
}

export const demoJobs: DemoJob[] = [
  {
    co: "Salesforce",
    t: "Director, Corporate Strategy",
    loc: "San Francisco, CA. Hybrid",
    p: 74,
    s: "USD 190k to 240k",
    l: "Director",
    w: ["Led a 3 year cost program across 4 units", "Sponsorship offered on this posting"],
    act: "apply",
  },
  {
    co: "Uber",
    t: "Group Product Manager, Growth",
    loc: "New York, NY. Hybrid",
    p: 52,
    s: "USD 170k to 200k",
    l: "Senior manager",
    w: ["Consumer growth asked, you are B2B"],
    act: "skip",
  },
  {
    co: "Stripe",
    t: "Strategy and Operations Lead",
    loc: "New York, NY. Hybrid",
    p: 71,
    s: "USD 175k to 215k",
    l: "Senior manager",
    w: ["Consulting background fits", "PMO leadership of 6"],
    act: "apply",
  },
  {
    co: "Spotify",
    t: "Manager, Strategy and Business Planning",
    loc: "Remote, US",
    p: 69,
    s: "Not listed",
    l: "Manager",
    w: ["Planning cadence matches your PMO work", "Remote US passes your filter"],
    act: "apply",
  },
  {
    co: "Datadog",
    t: "Sr. Director, Corporate Strategy",
    loc: "New York, NY. Hybrid",
    p: 64,
    s: "USD 210k to 260k",
    l: "Senior director",
    w: ["12 years asked, you have 10"],
    act: "skip",
  },
];

/** Ticker under the hero deck. `strong` lines are ink, the rest are muted. */
export const feedLines: { strong: boolean; text: string }[] = [
  { strong: true, text: "Tailoring resume for Salesforce from Strategy v3" },
  { strong: true, text: "Submitted to Salesforce. Receipt saved" },
  { strong: false, text: "Interview invite from Datadog landed in your inbox" },
  { strong: false, text: "Snowflake asks for an assessment, due Monday" },
  { strong: true, text: "Strategy lane sent 4 applications while you slept" },
  { strong: false, text: "Daniel drafted your Datadog prep plan" },
  { strong: true, text: "Submitted to Stripe. Confirmation email matched" },
  { strong: false, text: "Dana at Airbnb asked about your availability" },
];

/** Company domains for Logo.dev, used by the hero deck and home mocks. */
export const companyDomains: Record<string, string> = {
  Salesforce: "salesforce.com",
  Stripe: "stripe.com",
  Spotify: "spotify.com",
  Datadog: "datadoghq.com",
  Uber: "uber.com",
  Snowflake: "snowflake.com",
};

/** "From resume to offer, in 5 steps." */
export const steps = [
  {
    n: "Step 01",
    h: "Upload your resume",
    p: "Jobluvo extracts your experience and asks you to confirm it. Add your work authorization and the roles you want. Ten minutes.",
  },
  {
    n: "Step 02",
    h: "Jobluvo searches while you sleep",
    p: "Career pages on 19 application systems, checked every few minutes. New roles are scored against your profile with the reasons shown.",
  },
  {
    n: "Step 03",
    h: "Swipe, or let a lane apply",
    p: "Pick jobs one card at a time, or set a lane with your rules and a daily cap and let it apply to strong matches automatically.",
  },
  {
    n: "Step 04",
    h: "Track replies in one place",
    p: "Every employer reply lands in your Jobluvo inbox, gets linked to the right application and moves it along the pipeline. Nothing to update by hand.",
  },
  {
    n: "Step 05",
    h: "Maya and Daniel get you the offer",
    p: "Maya preps you for each interview with mock rounds and a salary number you can defend. Daniel keeps the longer plan on track, from the skills to add next to the role after this one.",
  },
];

/** "Two ways to drive, two people to ask." */
export const aroundIt = [
  {
    h: "Swipe",
    p: "One job at a time with everything you need to decide. Right to apply, left to skip.",
  },
  {
    h: "Lanes",
    p: "Up to five auto apply configurations sharing one daily cap. Jobs above the bar are applied, not shown.",
  },
  {
    h: "Maya",
    p: "Your job search agent. Tunes the feed, finds companies, checks applications before they go out.",
  },
  {
    h: "Daniel",
    p: "Your career coach. Skills to add, resume positioning, outreach and interview prep.",
  },
];

/** "What Jobluvo will not do." */
export const willNotDo = [
  {
    h: "Invent anything",
    p: "If a form needs something you have not given, the application waits.",
  },
  {
    h: "Automate LinkedIn",
    p: "Against LinkedIn's rules and a risk to your account. Saved LinkedIn jobs are resolved to the employer's own page instead.",
  },
  {
    h: "Beat bot checks",
    p: "CAPTCHAs and phone checks are handed to you to complete.",
  },
];
