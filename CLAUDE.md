@AGENTS.md

# Jobluvo

Jobluvo is a job search and application platform for individual job seekers. Users
upload a resume, confirm the extracted facts, and Jobluvo finds matching jobs across
employer career pages, tailors a truthful resume for each one, submits the application
and tracks every employer reply in a built in inbox.

Jobs are picked one card at a time in a swipe view, or applied to automatically through
lanes with the user's own rules and a daily cap. Two named agents live in a side panel:
Maya for job search and interview prep, Daniel for career coaching.

Initial market is the United States. Web first, with iOS and Android to follow. The
website includes the actual product dashboard, not just marketing.

Sources of truth:

- `.claude/skills/jobluvo-design/` the design system: tokens, components, guidelines,
  and the delivered marketing site and app screens.
- `design/docs/01-Product-BRD.md` product brief and business requirements.
- `design/docs/02-Implementation-Plan.md` high level implementation plan.
- `design/docs/04-Job-Parsing-and-ATS-Integration.md` discovery and execution per
  platform.

When product facts and this file disagree, the docs win. Update this file to match.

## Positioning

Jobluvo is marketed as a career engine: find the next job and build the career system
behind it. Copy speaks to people looking now and people planning ahead, not only to
volume applying. The commercial promise is more completed applications for a lower
subscription price than competitors.

A submission to an unsuitable role is not a success. Volume is a benefit, not the goal.

## Plans and prices

Free trial of 25 applications with the full apply workflow. Agents are excluded from the
trial to keep model costs off unpaid accounts.

| Plan | Monthly | Quarterly | Annual | Provisional allowance |
|---|---|---|---|---|
| Starter | USD 16 | USD 42 | USD 149 | 750 a month |
| Pro | USD 35 | USD 74 | USD 269 | 1,750 a month |
| Max | USD 89 | USD 199 | USD 699 | 5,000 a month |

Starter and Pro include tailoring, Swipe and List views, both agents and the Jobluvo
inbox. Pro adds priority on fresh jobs. Max adds Auto Apply with up to five lanes,
review before submit, standing instructions and agent tuning of lanes.

Allowances are provisional until the pilot measures cost per verified submission. Do not
publish exact allowance numbers as commitments.

## Application systems

The 19 systems in the competitor disclosure are Workday, Greenhouse, Lever, Ashby,
Rippling, iCIMS, BambooHR, Workable, JazzHR, Jobvite, BreezyHR, Oracle Cloud,
SmartRecruiters, Paylocity, UltiPro, ADP, Dover, Gem and Zoho Recruit.

This is a competitor research list, not a Jobluvo launch coverage commitment. First
adapters target Greenhouse, Lever and Ashby, with Workday developed early and enabled
only for validated configurations.

Discovery and execution are separate capabilities with different constraints. A platform
can be easy for one and hard for the other. Coverage is tiered A to D; state both tiers
when describing a platform.

## LinkedIn

LinkedIn is a discovery and distribution platform, not an application destination.
Finding a role on LinkedIn and submitting it on an employer career page are separate
capabilities.

LinkedIn prohibits unauthorized scraping and automated activity, and its talent APIs
require approval. The baseline is: save the LinkedIn URL, find an independently
available employer listing, and apply there when supported. LinkedIn only roles stay
manual handoff items.

Never describe Jobluvo as supporting native LinkedIn Easy Apply. Not in code comments,
not in UI copy, not in marketing.

## Demo data

Demo user is Jack Miller, jack.miller@jobluvo.com. Demo companies are Salesforce,
Stripe, Spotify, Datadog, Mistral AI, Nvidia, Shopify, Snowflake, Airbnb and Uber.

Use these everywhere mock data is needed so screenshots and screens stay consistent.

## Design system

Read `.claude/skills/jobluvo-design/readme.md` before building any UI.

Hard rules: monochrome warm greys, no shadows, Geist 400/500/600, 1px borders, status by
glyph and border weight never colour, plain short copy with no em dashes, "resume" not
"résumé".

Tokens live in `src/app/globals.css`, copied from the handoff. Shared components live in
`src/components`, mirroring `website/components` in the skill. `/styleguide` renders every
component in its states.

Depth comes from 1px borders and background steps, never shadows. Company logos are the
only colour, plus one muted red for error, failed and rejected. No orange, yellow, blue
or green anywhere.

## Copy rules

Plain language, short sentences, no hype. Facts first, then the one thing the user can
do. Second person for the user, third person for Jobluvo, first person for the agents in
chat.

- No em dashes. Use a full stop or a comma.
- No emoji. No exclamation marks.
- Sentence case everywhere, including buttons and tabs.
- Write "resume", never "résumé".
- Numbers as digits with tabular figures: "8 of 10 applications today",
  "USD 175k to 215k".
- Dates as "18 Sep" or "Thursday 18 September".
- Agents end each message with one concrete offer or question.

Examples: "Salesforce needs an answer from you." "Submitted. Receipt saved." "Nothing is
added that is not on your profile."

## Working rules

- One branch per feature. Branch from `main`.
- Never push to `main` directly. Every change lands through a pull request.
- Open pull requests with `gh pr create`. On Windows `gh` is not on the bash PATH; use
  `"C:\Program Files\GitHub CLI\gh.exe"` or run it from PowerShell.
- Before every push, all three must pass: `npx tsc --noEmit`, `npx eslint .` and
  `npm run build`. Do not push a red build.
- Ask before adding a dependency. Say what it buys and what it costs.
- Ask before changing a design token. Tokens come from the handoff; if one is wrong, fix
  it in `.claude/skills/jobluvo-design/tokens/` too so the design system and the code
  agree.
- Verify UI changes in the browser, not only in tests.
- Never remove, merge, simplify or replace a page, section, animation or interaction that exists in the delivered design (.claude/skills/jobluvo-design/uploads/05-Website.html and the app screens) on your own. If you think something should change, ask first and wait for an answer. Never describe an unapproved change as a deliberate deviation after the fact.

## Commands

```bash
npm run dev          # dev server on port 3000
npm run build        # production build
npx tsc --noEmit     # typecheck
npx eslint .         # lint
```

## Layout

```
src/app/            routes. globals.css holds the tokens, fonts.ts loads Geist
src/app/styleguide/ every component in every state
src/components/     shared library: core, data, jobs, feedback, navigation, agent
src/lib/            helpers, including Logo.dev URLs
.claude/skills/     the design system handoff, treated as read mostly reference
design/docs/        product brief, implementation plan, ATS integration plan
```

The handoff under `.claude/skills/` is excluded from ESLint. It is reference material,
not app source.
