# Jobluvo design system

Jobluvo is a job search and application platform for individual job seekers. Users upload a resume, confirm the extracted facts, and Jobluvo finds matching jobs across 100,000+ employer career pages on 19 application systems, tailors a truthful resume for each one, submits the application and tracks every employer reply in a built in inbox. Jobs are picked one card at a time in a swipe view or applied to automatically through lanes with the user's own rules and a daily cap. Two named agents live in a side panel: Maya (job search and interview prep) and Daniel (career coach). Plans: Starter, Pro, Max. Free trial of 25 applications.

Sources: the marketing site `uploads/05-Website.html` (layouts, spacing, monochrome palette). Quality bar: jackandjill.ai and app.jackandjill.ai (feel, not layouts). This folder covers the web product; a mobile system will be separate.

## Index

- `styles.css` imports every token file. Link this one file.
- `tokens/colors.css`, `typography.css`, `spacing.css`, `shape.css`, `fonts.css`
- `tokens/tailwind.config.js` (Tailwind v3) and `tokens/tailwind.theme.css` (Tailwind v4 `@theme`) map 1:1 to the CSS variables
- `guidelines/*.card.html` foundation specimens shown in the Design System tab
- `website/components/` React components, one folder per concern: `core` (Button, Input, Select, Toggle), `data` (StatusTag, Card, StatTile, TableRow, KanbanCard, InboxRow), `jobs` (JobCard, SwipeCard), `feedback` (Banner, Modal, Toast), `navigation` (TopNav), `agent` (ChatBubble). Each has a `.d.ts` and `.prompt.md`.
- `website/screens/Jobluvo App.dc.html` the product: Dashboard, Jobs (list and swipe), Auto Apply, Tracker, Inbox, Profile, Settings, with the collapsible agent panel
- The marketing site stays as delivered in `uploads/05-Website.html`. It is the source of this system, not a target of it.
- `SKILL.md` for use in Claude Code

## Content fundamentals

Plain language, short sentences, no hype. Facts first, then the one thing the user can do. Second person ("you"), Jobluvo and the agents in third person or first person for the agents in chat. No em dashes; use a full stop or a comma. No emoji. No exclamation marks. Sentence case everywhere, including buttons and tabs. Write "resume", never "résumé". Numbers as digits with tabular figures: "8 of 10 applications today", "USD 175k to 215k". Dates as "18 Sep", "Thursday 18 September".

Examples: "Salesforce needs an answer from you." "Submitted. Receipt saved." "Nothing is added that is not on your profile." Agents end each message with one concrete offer or question: "Want a 30 minute mock tonight?"

Demo user: Jack Miller, jack.miller@jobluvo.com. Demo companies: Salesforce, Stripe, Spotify, Datadog, Mistral AI, Nvidia, Shopify, Snowflake, Airbnb, Uber.

## Visual foundations

**Colour.** Monochrome: black `#111214`, white, and a warm grey ramp (50 `#f7f7f3` to 900). Company logos are the only colour. One muted red `#b4423f` for error, failed and rejected, used as text or border, never as a fill behind text. No orange, yellow, blue or green anywhere.

**Surfaces instead of shadows.** No shadows or glows. Depth is 1px borders (`--border` grey-200 resting, `--border-strong` grey-300 for controls and hover, black for focus, selection and attention) plus background steps (`--surface-1` hover and sunken areas, `--surface-2` selected rows and pressed states, `--surface-header` grey-200 for card and table headers with ink text and a grey-300 rule, two steps above hover so the two never blur). Inverse black surfaces are reserved for primary buttons, attention tags, offer tags and toasts.

**Type.** Geist (SIL OFL, `npm i geist` or Google Fonts), weights 400, 500, 600 only. 500 is the only emphasis in product UI; 600 is for the wordmark and stat values. Product default 13px/20px, reading 14px/20px. Titles 22px at -0.02em. Marketing hero 52 to 56px at -0.03em. Tabular numerals everywhere numbers align.

**Spacing.** 4px base. 12 and 16 do most of the work. Cards pad 16, page padding 32, section gap 24. Density is user switchable: compact rows 32px, regular 40px. Controls 28, 36, 44.

**Radii.** 3 tags, 6 buttons and inputs, 8 cards and toasts, 12 modals and the swipe card, full for toggles and chips.

**Status without colour.** StatusTag encodes state with a 10px glyph and a chrome tier. Solid black = needs you, held for review, offer. Black border = interviewing. Grey border = submitted, verifying, applied, replied. Dashed border and grey text = ghosted. Muted red text = failed. Grey text and light border = rejected. The tracker column position is the status; kanban cards carry no tag.

**Motion.** 120ms for state, 200ms for movement, `cubic-bezier(.2,.8,.2,1)`. Swipe cards leave at 200ms with a rotation. Nothing bounces.

**Hover and press.** Hover fills surface-1 or darkens a primary one step. Press fills surface-2. Focus is a 1px black border, no ring. Selected rows fill surface-2 and get a 2px black left edge in lists.

**Layout.** Agent panel 320px on the left (48px collapsed), top nav 52px with a 1px underline on the active tab, content max 1400px, desktop first at 1400px with a 1280px minimum.

**Imagery.** None. Employer logos from Logo.dev at 16, 24, 32 and 40px inside a 1px border with radius 3 to 8. Application system wordmarks (Workday, Greenhouse, Lever, Ashby and the rest) are extracted from the site into `website/assets/ats/` for reuse. No illustrations, no photos, no avatars for people; the company is the sender.

## Iconography

Lucide, stroke 1.5, at 14, 16 and 20px, inline SVG. Icons are never filled or coloured. Status glyphs are a custom 10px set defined in `StatusTag.jsx`. No icon font, no emoji, no unicode glyphs except "+" and "-" as reason markers and "×" to close.

## Intentional additions

- `useHover.js` helper for hover and press state in components.
- StatusTag glyph set, since the brief bans colour for status.

## Caveats

- Component specimen cards are static HTML rather than mounted from the bundle; the bundle namespace was not available while authoring.
- Logo.dev images use the publishable token supplied by the user and load from the network.
