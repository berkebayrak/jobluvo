@AGENTS.md

# Jobluvo

Jobluvo is a job search and application platform for individual job seekers. Users
upload a resume, confirm the extracted facts, and Jobluvo finds matching jobs across
employer career pages, tailors a truthful resume for each one, submits the application
and tracks every employer reply in a built in inbox.

Jobs are picked one card at a time in a swipe view, or applied to automatically through
lanes with the user's own rules and a daily cap. Two named agents live in a side panel:
Maya for job search and interview prep, Daniel for career coaching.

Jobluvo is not restricted by country. The user chooses the countries they want to work
in, the hard filter honours that choice, and the only real limit on what anyone sees is
which employer boards are in the registry. The location parser handles US locations best
today and is being widened as boards outside the US arrive. Web first, with iOS and
Android to follow. The website includes the actual product dashboard, not just marketing.

Sources of truth:

- `.claude/skills/jobluvo-design/` the design system: tokens, components, guidelines,
  and the delivered marketing site and app screens.
- `design/docs/01-Product-BRD.md` product brief and business requirements.
- `design/docs/02-Implementation-Plan.md` high level implementation plan.
- `design/docs/04-Job-Parsing-and-ATS-Integration.md` discovery and execution per
  platform.
- `design/docs/06-Decision-Log.md` decisions taken during build that the other docs
  assume but do not state, newest first, each with what it was measured against.
- `design/docs/07-Phase-0-Cost-Summary.md` the phase 0 deliverable: the three measured
  cost terms, each named for what it is paid per, and the upstream model cost per
  application as a band against the budget.
- `design/snapshots/` frozen data populations with what reproduces them, one dated
  directory each, read before any restamp or measurement over stored rows.

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

This is a competitor research list, not a Jobluvo launch coverage commitment. Phase 0
discovers jobs on the six families with unauthenticated JSON feeds: Greenhouse, Lever,
Ashby, SmartRecruiters, Workable and Gem. Adapters live in `src/server/sources`, one
file per family, seeded from `registry.ts`. The other thirteen, Workday, iCIMS, Oracle
Cloud, BambooHR, BreezyHR, JazzHR, Jobvite, Paylocity, UltiPro, ADP, Dover, Rippling
and Zoho Recruit, are next phases. Workday is developed early and enabled only for
validated configurations. Submission is not built yet on any family.

Roles that require a security clearance are out of scope by product decision. The hard
filter fails them with the reason "needs a security clearance, Jobluvo does not handle
these", and that rule stays even if a clearance field is added to the profile.

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

When the delivered design and the design system disagree: on the marketing site the token
type scale stands, and the delivered value wins only where it has no token equivalent and
the difference is visible; in the product app the tokens win. The design system readme
states that the marketing site is the source of this system, not a target of it.

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
- Before every push, all four must pass: `npx tsc --noEmit`, `npx eslint .`, `npm test`
  and `npm run build`. Do not push a red build. Run them with `npm run check`, which
  refuses a tree that is not clean, so the result describes the commit and not something
  half saved, and stops at the first non zero exit instead of reading past it.
- Prove a fix by breaking it: disable the fix, show the test fails, restore it. Commit
  before you break it. On top of a commit the break is a diff and `git checkout` restores
  the file; on top of uncommitted work the break sits beside the only copy and `git
  checkout` destroys it. That has eaten work twice. A backup file is a workaround, not
  the procedure.
- A restamp (`npm run validator-report -- --apply`) is applied only from merged code, never
  from a branch. Report the table before and after and name the rows that moved. Applying
  one from an unmerged branch leaves production in a state no committed code can explain.
- Ask before adding a dependency. Say what it buys and what it costs.
- Ask before changing a design token. Tokens come from the handoff; if one is wrong, fix
  it in `.claude/skills/jobluvo-design/tokens/` too so the design system and the code
  agree.
- Verify UI changes in the browser, not only in tests.
- The principle is at the top of `design/docs/06-Decision-Log.md`: a tailored line may
  change how something is said, it may not change what is being claimed. Its cases are
  case 0 something in no confirmed fact, case 1 stronger wording with the same claim
  which is allowed, case 2 a number moved to a different subject, case 3 the same work at
  a higher level of authority, case 4 polarity, a denial reversed or a loss published as
  a gain.
- **The prompt carries that principle now, the validator does not (D-034).** The four
  prohibitions in `RULES` in `src/server/packet/tailor.ts` are cases 2, 3, 4 and 0 in
  plain language, and they are the main line of defence. The code checks one thing: a
  value or a name that appears nowhere in the user's confirmed facts is a hard finding,
  profile wide. Do not add a rule that reads what a line means and compares it with what
  a fact means; that was removed on the user's decision and putting it back is a product
  decision that goes back to the user.
- **A finding may reject a packet only when what it found is certain (D-036).** A finding
  derived from a guess about a word's shape holds the packet for a person instead: the
  tailored resume is kept and the finding names the word. A new check that cannot say
  which of the two it is, holds. One finding can reject, `value-unknown`, and **only while
  every number on the profile could be read** (D-040): the lookup compares parsed values,
  so a fact whose own number the normaliser could not read means the absence of a match
  proves nothing, and the finding holds instead. Every name and posting word check holds.
- **A rejection blocks the document, it does not delete it (D-038).** The run and the
  replay keep the rejected candidate and its hash on the row. `consumableResume` is the
  one door and it serves a `ready` packet only, so the status is what stops a rejected
  document, not its absence. Do not add a path that clears a resume to stop it being used.
- Never say or imply that Jobluvo verifies a tailored resume is truthful. It does not.
  Measured over 32 known false lines: **8 are flagged, 4 of them rejected and 4 held**, and
  24 pass. Of a second author's 14, none is flagged at all. Say "flagged", not "caught": a
  held line is not a caught fabrication, because nobody has decided any of them yet.
  `npm run probe-cheap-check` reproduces that, and `pairs.test.ts` records it, which no
  longer asserts the old "28 of 28". The hand written check is a placeholder until the
  checking model call of D-036 is built; it is not the design.
- **A repaired row's document is consistent with the row, not proven to be its own (D-048).**
  `--repair-from` accepts a document only when the row's stored changes reproduce it, which is a
  compatibility check and not an identity one: any document those changes could produce would
  pass. The `resume-repaired` finding does not survive a replay and is already gone from all four
  repaired rows. Say "consistent with", never "verified as". Real provenance is phase 1 item 19
  and happens before any repair touches a real user's row.
- **The current state of the stored packets lives in one place**, the
  `Current state, 19 September 2026` section at the top of
  `design/docs/07-Phase-0-Cost-Summary.md`. Every other figure on that page keeps its date
  and the population it was measured on. The 107 stored rows are two profiles and never one
  rate. Quote the current state section, not a dated paragraph below it.
- Never remove, merge, simplify or replace a page, section, animation or interaction that exists in the delivered design (.claude/skills/jobluvo-design/uploads/05-Website.html and the app screens) on your own. If you think something should change, ask first and wait for an answer. Never describe an unapproved change as a deliberate deviation after the fact.

## Commands

```bash
npm run dev          # dev server on port 3000
npm run build        # production build
npx tsc --noEmit     # typecheck
npx eslint .         # lint
npm test             # unit tests (vitest)
npm run check        # the four checks on the committed tree, stopping on the first failure
npm run seed         # demo user and the source registry, verifies each feed first
npm run ingest       # one ingest batch against the live feeds, prints a line per source
npm run db:generate  # migration from src/db/schema.ts
npm run db:migrate   # apply migrations over the direct Neon host
npm run db:backfill-locations  # re-parse stored locations with the current parser, safe to repeat
npm run db:backfill-signals    # recompute sponsorship and eligibility from stored text, safe to repeat
npm run pass-rate    # hard filter pass rate across ingested jobs, by family and reason
npm run boilerplate-report  # what the boilerplate rule strips per board, and what a rule change releases
npm run freshness    # jobs arriving per day and how many pass the filter, by board date and by first seen
npm run dedupe-report  # what a dedupe rule change releases and what it withholds, before it ships
npm run validator-report  # what the claim validator says about every stored packet; -- --apply restamps them under the rules as they stand
npm run probe-cheap-check  # what the validator catches and what it does not, over the saved answers and the known false lines, read only
npm run cost-report  # cost per call by run, wrong citations, and calls of unknown cost
npm run snapshot-packets -- --out <dir>  # freeze packets, cost rows, facts, jobs and the profiles behind them to files, read only
npm run reconcile-sample -- --dir <dir>  # a stored sample against its saved answers, attempt by attempt, from the snapshot alone
```

Every sample script takes typed flags (`src/lib/cli.ts`): a boolean flag such as `--no-store` or
`--dry` reads the same in any position, and the parsed flags are printed before anything runs.

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
