# Jobluvo, Product brief and business requirements

Version 0.3, 12 September 2026. Planning baseline for founder review. Updated with the dashboard redesign, plan tiers, agent entitlement and the marketing site; see [Dashboard mockup](03-Dashboard-Mockup.html), [Website](05-Website.html) and [ATS integration plan](04-Job-Parsing-and-ATS-Integration.md).

Companion: [High-level implementation plan](02-Implementation-Plan.md)

## 1. Purpose and product promise

Jobluvo helps individual job seekers discover suitable jobs, prepare accurate application materials, submit applications, and manage employer responses from a website and iOS/Android apps. The initial job inventory and parsing focus on the United States, while accommodating applicants living elsewhere.

The intended commercial promise is **more completed applications for a lower subscription price**, with an engaging mobile experience for people who want to choose their opportunities and an autonomous mode for people who want the search handled for them.

The core loop is:

**Create profile → set search and approval preferences → discover jobs continuously → swipe or select automatically → tailor materials → review when required → apply → verify submission → manage replies.**

Success means suitable, accurate, verified applications and useful employer conversations. Application volume is a commercial benefit, but a submission to an unsuitable role is not a successful product outcome.

## 2. Confirmed decisions and planning assumptions

### Confirmed by the founder

| Decision | Requirement |
|---|---|
| Working name | Jobluvo. Brand/domain availability has not been checked. |
| Customer | Individual job seekers. |
| Initial market | US job inventory and US-focused parsing; broader geographic expansion later. |
| Initial delivery | Website, iOS app, Android app. The website includes the actual product dashboard. |
| Positioning | Lower prices and more applications than Tsenta. |
| Discovery | Continuous discovery from sources; users should not have to find every job themselves. |
| Mobile interaction | Tinder-like swipe to apply or skip, with further engagement and sharing features to explore. |
| Execution | End-to-end automation with user-configurable approval preferences. |
| Documents | Job-description-based resume adjustment, with review and confirmation controls. |
| Email | A professional address allocated in the app, using the person's name and alternatives when unavailable; inbox visible to the user. |
| Excluded channels | iMessage, WhatsApp, and a customer-facing MCP service. |
| Web navigation | Five top-level areas: Dashboard, Jobs, Auto Apply, Tracker, Inbox. Profile lives behind the avatar at top right; Settings sits next to it. No Networking or Research areas. |
| Agents | Two named agents in a collapsible side panel with a switcher: the Job search agent (feed tuning, company discovery, resume and application checks, queue questions) and the Career coach (skills, certifications, resume positioning, networking and interview preparation). A single generic chat is not the model. |
| Jobs area | Two views of the same inventory: a card list and a one-job-at-a-time Swipe view with full detail. An Auto Apply toggle sits on the page with a link to the lanes. When Auto Apply is on, jobs above the bar are applied, not shown; the list then shows only what is left for the user. |
| Auto Apply | Configured as lanes (up to 5), each with its own resume profile, filters, standing instructions, match bar, review setting and tailoring options. All lanes draw from one shared daily cap, best matches first. |
| Plans | Free trial of 25 applications, then Starter, Pro and Max. Monthly 16 / 35 / 89 USD, quarterly 42 / 74 / 199, annual 149 / 269 / 699. Max unlocks Auto Apply. Allowances (750 / 1,750 / 5,000 a month) remain provisional. |
| Agents entitlement | Maya and Daniel are available on paid plans only. The free trial includes the full apply workflow but not the agents, to keep model costs off unpaid accounts. |
| Positioning | Jobluvo is marketed as a career engine: find the next job and build the career system behind it. Copy speaks to people looking now and people planning ahead, not only to volume applying. |
| Marketing site | One responsive site with Home, How it works, Pricing, Blog, FAQ, Sign in and Sign up. Sign in offers Google and email only. The blog follows a comparison-led editorial model (Jobluvo vs each competitor, plus segment guides). |
| Inbox | A top-level area of its own, not a sub-tab of the Tracker. The Tracker holds the hiring pipeline only. |
| Application email | Every account gets a generated Jobluvo address at sign up, used by default for employer accounts and confirmations, forwarding a copy to the sign-in address. Users can switch to their own email instead. |
| Responsive layout | One web codebase. Above tablet width the navigation is a top bar; below it the same areas move to a bottom tab bar and the agent panel becomes a sheet opened from a floating button. |

### Proposed assumptions, not yet approved decisions

1. Launch execution happens in the cloud so applications continue when the phone or browser is closed.
2. The in-app address is on a domain controlled by Jobluvo, for example `first.last@<owned-mail-domain>`. It is not an automatically registered Gmail or Outlook consumer account.
3. “Local execution (LATAM etc.)” is ambiguous. This plan includes later regional localization for LATAM and treats a runner on the user's computer as a separate future capability.
4. All three required client platforms launch with the core workflow. Browser extension and installed desktop client follow; a desktop-width website is included initially.
5. The first automated submission adapters target Greenhouse, Lever, and Ashby, with Workday developed early and enabled only for validated configurations. Broad Tsenta-level coverage is a staged objective.
6. Pricing and volume caps remain provisional until actual execution costs are measured. The lower-price/higher-volume direction is confirmed; numerical promises are not.

## 3. Competitor findings that affect development

The supplied [Tsenta llms.txt](https://tsenta.com/llms.txt) describes desktop/local browser automation. Its more recent [Chrome extension listing](https://chromewebstore.google.com/detail/tsenta/momaobilceffibifldnhndcehhdjgaob) describes cloud execution. These sources conflict; they do not establish Tsenta's current internal architecture.

Tsenta's mobile release history already mentions swiping, saved/skipped jobs, resume editing, and recruiter discovery. Swiping alone is therefore not a unique feature. Jobluvo's opportunity is to make selection, explainable matching, review, and follow-through measurably better and more affordable. [Tsenta App Store listing](https://apps.apple.com/us/app/tsenta/id6760728258)

Its current feature disclosure lists these 19 systems: Workday, Greenhouse, Lever, Ashby, Rippling, iCIMS, BambooHR, Workable, JazzHR, Jobvite, BreezyHR, Oracle Cloud, SmartRecruiters, Paylocity, UltiPro, ADP, Dover, Gem, and Zoho Recruit. This is a competitor research list, not a Jobluvo launch coverage commitment. [Tsenta feature disclosure](https://tsenta.com/ai-disclosure)

### LinkedIn interpretation

LinkedIn is a discovery/distribution platform; systems such as Greenhouse are employer application destinations. Finding a role on LinkedIn and submitting it on an employer's career page are separate capabilities.

LinkedIn says it prohibits unauthorized scraping and automated website activity. Its talent APIs require approval and are not an unrestricted job-seeker search/apply API. Therefore the baseline includes saving a LinkedIn URL, finding an independently available employer listing, and applying there when supported. LinkedIn-only roles remain manual handoff items unless a suitable authorized integration is obtained. Do not represent this as native LinkedIn Easy Apply support. [LinkedIn software policy](https://www.linkedin.com/help/recruiter/answer/a1341387), [API access](https://learn.microsoft.com/en-us/linkedin/shared/authentication/getting-access)

## 4. Business objectives and measurement

The following are proposed validation targets, not claims about current performance.

| Objective | Measure | Initial validation target |
|---|---|---|
| Useful onboarding | Verified profile, preferences, and first relevant jobs | Median under 10 minutes, excluding user pauses |
| Fast activation | First verified submission after selecting a compatible job | Median under 15 minutes, excluding review/challenges |
| Good matching | User acceptance of sampled top-20 matches | At least 70% considered relevant in target cohorts |
| Reliable execution | Verified submissions / eligible supported attempts | At least 95% in the release benchmark; publish exclusions and all other outcomes alongside it |
| Accurate content | Unsupported factual claims in release evaluation | Zero invented credentials, employers, dates, authorization answers, or achievements |
| Useful freshness | Source observable change to indexed job | Priority-source p95 within 10 minutes when source access permits |
| Sustainable value | Contribution margin at full included usage | Positive after retries, browser work, AI, mail, store/payment costs, and variable support |
| Real job-search outcomes | Positive employer replies and interviews per 100 verified applications | Establish pilot baseline; compare by role and candidate cohort |

Also track seven-day activation, weekly returning users, time to first employer reply, cancellation reasons, and refund rate. Interpret retention in context: a user leaving after accepting a job can be a successful outcome.

## 5. Users and modes

### Primary user situations

| Situation | Need | Main mode |
|---|---|---|
| Active high-volume search | Consistent applications without repetitive work | Autopilot |
| Selective search | Choose companies and roles personally | Swipe/select |
| International applicant targeting US jobs | Explicit authorization, sponsorship, and geographic constraints | Either mode with strict eligibility rules |
| Career changer or multiple target roles | Different approved resume variants and search rules | Separate lanes |

People from any profession may use Jobluvo. Pilot cohorts should be chosen for measurable inventory and tested application coverage; do not market universal profession or platform coverage before validating it.

### Separate two decisions in the product

**Job selection:** manual swipe/list selection, automatic selection within a lane, or both across separate lanes. A lane is the product name for what earlier drafts called a campaign; the terms are equivalent.

**Submission approval:** review every complete application, review only exceptions under an approved policy, or automatic submission using approved facts and rules.

Document preferences are independently configurable: original resume, tailored resume with per-job review, or automatic tailoring within approved limits. A lane in automatic mode can still pause for a required resume review. The UI must explain the resulting behavior before activation.

Switching mode does not silently expand consent for jobs already queued. In-flight work uses the stricter applicable authorization until the user explicitly updates it.

## 6. Scope and release boundaries

**L = core public launch. E = expansion after core launch. F = future exploration.** A closed beta may expose only a subset of L while the rest is completed.

| Capability | Scope | Notes |
|---|---|---|
| Website, web dashboard, iOS and Android | L | Shared accounts, data, subscription entitlements, and queue |
| Structured candidate profile and resume import | L | Human confirmation of extracted facts |
| US discovery, filtering, matching, fresh-job notifications | L | Start with a measured source registry and expand |
| Swipe/apply/skip/save and web list selection | L | Accessible buttons accompany gestures |
| Auto Apply lanes | L | Up to 5 lanes per account, shared daily cap, per-lane rules, pauses and review settings; Max plan only |
| Job search agent and Career coach | L | Side-panel agents with scoped tools; every change they propose is previewed and approved by the user |
| Tailored resumes, cover letters, screening answers | L | Evidence-linked facts and versioned review |
| End-to-end submission and exception recovery | L | Only validated systems/configurations |
| Jobluvo address and in-app inbox | L | Receive, reply, OTP handling, export, lifecycle policy |
| Optional existing inbox connection | L | Provider approval dependency; staging gates may differ |
| Tracker, receipts, notifications, billing and support | L | Core trust and operating requirements |
| Workday | L target | Early engineering track; launch coverage gated by evidence |
| Further ATS families | E | Prioritize actual unmet user demand |
| Browser extension | E | Capture supported employer jobs and show status |
| Recruiter discovery and outreach drafts | E | Reached through the Career coach rather than a Networking area; source/provider access required; no unsolicited automatic sending |
| Public candidate portfolio | E | Explicitly opt-in visibility |
| Referral credits and shareable progress cards | E | One controlled experiment can enter late beta |
| LATAM languages, job inventory and regional pricing | F | Localization and market expansion |
| Execution on user's computer | F | Separate architectural option from localization |
| iMessage, WhatsApp, customer MCP | Excluded | Explicit founder exclusions |

Offer negotiation, recruiter-side tooling, a Research area and a social feed are not committed scope. Interview preparation is limited to what the Career coach can build from the user's profile and inbox messages; a structured coaching product is a later scope decision.

## 7. Functional requirements

### A. Account, identity and candidate truth

| ID | Requirement and expected behavior |
|---|---|
| ID-01 | Register, sign in, recover access, and manage devices using a verified contact method independent of the newly allocated application address. |
| ID-02 | Import PDF/DOCX resumes and extract employment, education, projects, skills, dates, links and contact details. Flag ambiguity or poor scan quality. |
| ID-03 | Require confirmation of extracted profile data. Store field origin and verification state. Editing a resume must not silently change verified facts. |
| ID-04 | Support multiple named resume variants and campaigns; select the appropriate base for each role. Keep the original file downloadable. |
| ID-05 | Collect location, relocation, remote preferences, role families, seniority, employment types, salary expectations and exclusions. |
| ID-06 | Collect user-provided work authorization, current/future sponsorship need, start date and relevant licenses. Keep these explicit, dated, and editable. |
| ID-07 | Provide reusable answers and tone preferences. Ask whether an edit should apply only to this application or become a saved default. |

### B. Job discovery, US parsing and matching

| ID | Requirement and expected behavior |
|---|---|
| JOB-01 | Continuously monitor registered company sources with approved access methods, per-source refresh intervals, health tracking and retry/backoff. |
| JOB-02 | Normalize titles, companies, descriptions, locations, employment types, compensation, seniority, source IDs, URLs, timestamps and application destination. |
| JOB-03 | Parse US states, metro areas, multi-location postings, US-only remote eligibility, time-zone restrictions, USD ranges and hourly/annual pay separately. |
| JOB-04 | Extract sponsorship and authorization language with evidence and confidence. Missing information means unknown; a company's historical sponsorship is not a guarantee for this role. |
| JOB-05 | Deduplicate syndicated jobs by employer/requisition and destination identity; distinguish true new requisitions, reposts and multiple locations. |
| JOB-06 | Enforce hard constraints before ranking. Explain fit and missing evidence in plain language; distinguish a match score from a hiring probability. |
| JOB-07 | Let users save searches, block companies/keywords, report bad matches and provide optional skip reasons. Feedback may alter ranking, never silently relax hard rules. |
| JOB-08 | Track published time when provided, first seen time and last checked time separately. Mark uncertain or stale inventory and recheck before submission. |
| JOB-09 | Accept pasted/shared job links as an additional input. Unsupported jobs can still be saved with a clear handoff state. |

### C. Mobile discovery and engagement

| ID | Requirement and expected behavior |
|---|---|
| UX-01 | Right swipe/Apply selects a role, left swipe/Skip dismisses it, Save bookmarks it. All actions have labeled button equivalents on every platform, including desktop where keyboard shortcuts (left, right, S) also work. |
| UX-01a | The Jobs area offers a List view (cards in a grid) and a Swipe view (one job at a time). Both read the same filtered inventory and the user's choice of view is remembered. |
| UX-01b | The Swipe card shows enough to decide without leaving it: company, title, location and workplace type, posting age, match score with the reasons behind it, salary, experience and level asked, sponsorship signal, a plain-language summary of the job, the listed requirements, the destination system and the review mode that will apply. |
| UX-01c | An Auto Apply toggle is visible on the Jobs page with a link to the lanes. When it is on, jobs above any active lane's bar are applied automatically and disappear from the feed; the page explains that it now shows what is left: jobs below the bar, unsupported destinations and applications held for review. Jobs a lane already applied to never reappear in the deck. |
| UX-02 | Show company, title, location, compensation when known, freshness, match reasons, sponsorship uncertainty and application support before selection. |
| UX-03 | In review mode, Apply enters preparation/review. In automatic mode it queues submission after a visible short cancellation window. Label the action consistently with the active mode. |
| UX-04 | Offer undo before the submission commit point. After submission, explain that undo cannot retract an employer application; provide a withdrawal link/workflow when available. |
| UX-05 | Synchronize actions across devices, tolerate duplicate taps and offline actions, and revalidate stale selections when reconnecting. Offline swipes never imply completed applications. |
| UX-06 | Provide optional curated daily decks, saved collections and progress summaries. Avoid rewarding irrelevant application volume. |
| UX-07 | Trial sharing/referral features with explicit opt-in previews that omit employer correspondence, salary details and job-search status unless chosen by the user. |
| UX-08 | The web product has one responsive layout: top navigation bar with profile and settings at top right on wide screens, a bottom tab bar (Home, Jobs, Auto, Tracker, Inbox) on tablet and phone widths. Profile and Settings stay reachable from the avatar at every width. |

### D. Documents and application preparation

| ID | Requirement and expected behavior |
|---|---|
| DOC-01 | Extract role requirements and tailor resume ordering, phrasing and emphasis using only verified candidate evidence. Do not invent metrics, duties or skills. |
| DOC-02 | Generate cover letters and free-text answers from the role, company context and approved candidate facts. Answer required questions even when optional cover letters are disabled. |
| DOC-03 | Show a readable before/after diff and explain edits. Support inline editing, preview, choosing the original and explicit approval where configured. |
| DOC-04 | Export clean PDF and, where required, DOCX; validate text extraction, readability, file size, layout and destination file constraints. |
| DOC-05 | Bind approval to the exact job version, profile facts, answers and document hashes. A material change invalidates approval. Cosmetic layout-only changes need an explicit policy. |
| DOC-06 | Preserve the exact resume, letter and answers used in each submission. Updating the master profile cannot rewrite historical receipts. |

### E. Automation and application execution

| ID | Requirement and expected behavior |
|---|---|
| APP-01 | Users create up to five Auto Apply lanes. Each lane has a name, a resume profile, job filters, standing instructions in the user's own words (which can only rule jobs out), a minimum match quality (Excellent, Strong, Good, Stretch), a review-before-submit setting, resume tailoring level (Off, Honest, Aggressive), cover letter policy and the application email to use. |
| APP-01a | One daily cap (1 to 150) is shared across all lanes. Lanes change what is considered, not how much is sent; when the cap is reached the best remaining matches wait for the next day. Per-lane pause and a global Auto Apply toggle are available on every client and on the Jobs page. |
| APP-01b | Each lane shows a preview of what it would have applied to over the last seven days with the current rules, updated live as settings change, plus a run history. Auto Apply itself targets jobs posted in the last 24 hours and runs several times a day. |
| APP-01c | Auto Apply requires the Max plan. Lanes can be configured on any paid plan; only the master toggle is gated. |
| APP-02 | Execute account creation where necessary, login, multi-page forms, uploads, screening responses and final submission on supported destinations. |
| APP-03 | Reuse existing employer accounts when possible. Keep employer-specific credentials and session state isolated; avoid creating duplicates automatically. |
| APP-04 | Retrieve expected verification codes/links from the managed inbox or an explicitly connected mailbox. Route phone verification, CAPTCHA, unsupported assessments and ambiguous questions to the user. |
| APP-05 | Keep unknown or sensitive answers unresolved until the user supplies a value or an explicit applicable default. Never infer demographic, disability or authorization answers. |
| APP-06 | At submission, enforce current authorization, exact document versions, no prior duplicate, live job availability, and an available quota reservation. |
| APP-07 | Publish stage-by-stage progress and specific action requests. Users can cancel queued work or request a pause; describe any already-committed submission accurately. |
| APP-08 | Store positive submission evidence. If a network timeout occurs after clicking Submit, enter verification-pending instead of assuming success or retrying blindly. |
| APP-09 | Automatically retry safe preparation/navigation failures within a budget. Stop repeatedly failing destinations and show users the affected coverage. |
| APP-10 | Keep a global and per-campaign pause control available on every client. Do not silently lower match standards to consume a plan allowance. |

### F. Managed email and communications

| ID | Requirement and expected behavior |
|---|---|
| MAIL-01 | Allocate a unique name-based address at sign up, offer appropriate alternatives for collisions, and show the chosen address before first use. Avoid embedding birth dates or other unnecessary personal data in suggestions. |
| MAIL-01a | The generated address is the default for employer accounts and application confirmations, and forwards a copy of every message to the user's sign-in email. The user can switch to their own address for applications at any time from the Inbox address menu or Settings; switching does not move existing employer accounts. |
| MAIL-02 | Build an authenticated in-app inbox with threading, attachments, search, unread states, reply drafts and user-initiated sending from the allocated address. |
| MAIL-03 | Classify confirmations, verification requests, recruiter responses, interviews, offers and rejections; link to applications with confidence and an explicit unassigned state. |
| MAIL-04 | Restrict automated OTP processing to the expected employer, recipient, transaction and time window. A random email cannot instruct the agent to change behavior. |
| MAIL-05 | Allow optional existing-email connection and disconnection. Explain scopes and which inbox is used for each employer account. |
| MAIL-06 | Let the user review and send recruiter replies. Application automation consent does not automatically authorize unrelated messages or outreach. |
| MAIL-07 | Provide attachment screening, email HTML sanitization, delivery/bounce status, report-spam and sender-abuse controls. |
| MAIL-08 | Define address permanence, cancellation, forwarding/export and account deletion before launch. Never reassign a retired applicant address to another person. |

Proposed lifecycle: cancellation stops new paid application work but retains limited inbox access for 90 days, with export and reminders. Longer continuity/forwarding needs a costed policy. Account deletion has a separate explicit flow. Existing employer accounts may still reference this address, so a migration plan is essential. This is an open product decision, not a confirmed 90-day promise.

A custom-domain email provider can receive messages using MX records and webhooks; Jobluvo must still implement identity allocation, storage, permissions, threading, sending controls and the inbox UI. [Resend receiving domains](https://resend.com/docs/dashboard/receiving/custom-domains), [sender addresses](https://resend.com/docs/knowledge-base/how-do-I-create-an-email-address-or-sender-in-resend)

### H. Agents

| ID | Requirement and expected behavior |
|---|---|
| AGT-01 | Provide two named agents in a side panel with a switcher; each keeps its own conversation history. On narrow screens the panel opens as a sheet from a floating button. Agents are enabled on paid plans; on the free trial the panel shows what they do and an upgrade prompt. |
| AGT-02 | The Job search agent can read the user's profile, feed, lanes, queue and receipts. It can propose feed and lane changes, find companies not yet in the feed, review a prepared application and explain a match score. Every change it proposes is shown as a preview and applied only on the user's confirmation. |
| AGT-03 | The Career coach can read the profile, saved jobs, rejections and inbox. It gives advice on skills and certifications seen in target postings, rewrites resume sections from verified facts, drafts outreach messages and prepares short interview plans. It never sends anything on its own. |
| AGT-04 | Agents cannot loosen hard filters, change work authorization answers or submit applications. They may only propose; the user approves in the same place the change would normally be made. |
| AGT-05 | Agent answers cite the data they used (which lane, which jobs, which message) so the user can check them. Job descriptions and emails remain untrusted data for agents as for the rest of the system. |

### G. Tracking, commercial functions and operations

| ID | Requirement and expected behavior |
|---|---|
| TRK-01 | Provide application board and list views, search, filters, notes, stages and next actions. Distinguish execution progress from hiring progress: execution status (submitted, in flight, needs you, held for review, failed, verifying) lives on the Dashboard; the Tracker shows hiring stages only (Applied, Replied, Interviewing, Offer, Rejected, Ghosted). |
| TRK-01a | The Inbox is a separate top-level area with folders and labels (Interview, Assessment, Recruiter, Confirmation, Verification, Rejection, Offer, Unlinked), a message list and a reading pane. Each message shows which application it is linked to and lets the user correct the link. Verification codes used automatically are shown as such. |
| TRK-02 | Show a submission receipt with destination, timestamps, documents, answers and evidence. Show unknown results honestly. |
| TRK-03 | Update hiring stages from reliable messages; allow correction. Do not claim an employer viewed an application without evidence. |
| TRK-04 | Notify users about actionable reviews, failures, replies and interviews with quiet hours and digest controls. |
| BILL-01 | Provide trial, subscription, included volume, usage history, upgrade/downgrade, cancellation, receipts and support/refund flows. |
| BILL-02 | Reserve one application unit before execution; settle once after a verified submission. Release failed/canceled reservations and reconcile unknown outcomes before charging. |
| BILL-03 | Share entitlements across web/iOS/Android; handle purchase restoration, renewals, refunds, chargebacks and referral credits without duplicate benefits. |
| OPS-01 | Give staff audited, least-privilege tools to inspect redacted failures, pause connectors, manage support and resolve billing exceptions. |
| OPS-02 | Expose source/adapter health, supported configurations, success rates, challenge rates, cost per verified application and incident alerts. |
| OPS-03 | Allow account export, deletion and connector revocation; maintain a documented backup-expiry and essential-record retention process. |

## 8. End-to-end journeys

### Journey A, targeted mobile search

1. User uploads a resume, corrects parsed facts and selects US job preferences.
2. User chooses an application address and review preferences.
3. Jobluvo shows a deck with reasons for each match and relevant unknowns.
4. User swipes Apply; the app acknowledges selection and starts preparation.
5. The review screen shows the actual application packet, including all destination questions discovered so far.
6. User edits and approves the exact version. If later form steps introduce a material new question, Jobluvo requests another review.
7. The cloud worker submits, verifies and creates a receipt.
8. A recruiter response appears in the inbox and updates the application tracker.

### Journey B, autonomous search

1. User sets a campaign with hard rules, budget, approved factual profile, document policy and automatic submission authorization.
2. New jobs enter discovery, eligibility filtering and ranking.
3. Eligible jobs are selected within limits; the engine prepares and submits packets that satisfy the policy.
4. Unknown answers, challenges or mandatory review conditions create an actionable exception.
5. User receives a digest and urgent action notifications. Global pause prevents further commits once acknowledged by the service.

### Journey C, uncertainty and recovery

A worker clicks Submit and times out. Jobluvo marks the application “Checking submission,” holds its reservation for a bounded reconciliation period and examines the confirmation page/mail evidence. It records success if confirmed, safely retries only after establishing non-submission, or asks for review if the result remains unknown. A worker crash must not create another application or charge.

## 9. Business rules

| Rule | Decision |
|---|---|
| BR-01 | One active application workflow per user and canonical employer requisition; multi-location exceptions require explicit treatment. |
| BR-02 | Unknown required information pauses automation. A generated answer is not evidence of truth. |
| BR-03 | Current authorization and approved packet versions are checked immediately before submission. |
| BR-04 | A swipe is selection intent; whether it authorizes submission depends on the visible campaign settings. |
| BR-05 | One verified submission consumes at most one application unit, independent of internal retries. |
| BR-06 | An expired role, unsupported destination or failed application does not consume a completed-application unit. |
| BR-07 | Low inventory results in an explanation and optional user-driven preference changes, never unsuitable automatic applications. |
| BR-08 | Employer communications and documents are private by default. Sharing always uses an explicit preview. |
| BR-09 | A candidate's application address must not be assigned to a different person later. |
| BR-10 | Historical submission records remain immutable; corrections are subsequent events. |
| BR-11 | Account deletion and emergency pause stop new execution and revoke relevant credentials/sessions. |
| BR-12 | Job descriptions, websites and emails are untrusted data, not instructions to the automation system. |

## 10. Product information architecture

| Surface | Main screens |
|---|---|
| Public website | Home (career-engine positioning, animated product demo, supported systems, four-stage how it works, Swipe versus lanes, agents, planning-ahead section, pricing), How it works (four visual stages), Pricing (period toggle, feature table, pricing FAQ), Blog (comparisons and segment guides), FAQ, Sign in and Sign up (Google or email) |
| Web product | Dashboard, Jobs (List and Swipe), Auto Apply (lanes), Tracker (hiring pipeline), Inbox; Profile and Settings from the top-right avatar; agent side panel on every screen |
| iOS/Android | Same five areas as a bottom tab bar (Home, Jobs, Auto, Tracker, Inbox); Swipe is the default Jobs view; agents open as a sheet |
| Internal operations | Connector health, workflow exceptions, cost dashboard, support cases, billing reconciliation, audit events |

### Web dashboard layout

The dashboard mockup (03-Dashboard-Mockup.html) is the reference for the following:

1. Top bar: logo, five navigation items, plan pill showing tier and applications left, Settings button, avatar menu (Profile and resumes, Settings, Plan and usage, Help, Sign out).
2. Agent side panel on the left, collapsible, with the Job search agent and Career coach switcher, suggested prompts and a composer.
3. Dashboard: greeting with what happened since last visit, a banner for anything that needs the user, four stat tiles (applied this week, waiting on you, employer replies, interviews), top matches, lane status, recent activity and the full execution-status table with filters.
4. Jobs: search and filter bar, Auto Apply toggle with a link to lanes, List and Swipe switch. Swipe shows one job with a deck counter, progress and running counts of applied, saved and skipped.
5. Auto Apply: lane list with add, per-lane settings, shared daily cap, run history and the seven-day preview.
6. Tracker: hiring pipeline board (Applied, Replied, Interviewing, Offer, Rejected, Ghosted) with list toggle, CSV import and export, manual add.
7. Inbox: folders and labels, message list, reading pane with the linked application and a Career coach prep block for interview messages; address menu explaining the generated address, forwarding and the option to use the user's own email.
8. Profile: resume profiles, work authorization, target roles and locations, confirmed experience, saved answers.
9. Settings: plan and usage (Starter, Pro, Max), account, email addresses, notifications, connected accounts, privacy and data.

Every surface must make the difference between Selected, Awaiting review, Applying and Submitted clear. Empty inventory, missing facts, exhausted allowance, offline mode, unsupported destination, bounced mail and verification pending each need a designed screen/state.

## 11. Pricing and cost requirements

Tsenta currently advertises $19 for 600 applications, $39 for 1,500, and $99 for 4,500 per month. These are reference points, not validated Jobluvo economics. [Tsenta pricing](https://tsenta.com/#pricing)

Commercial structure: a free trial of 25 applications with the full apply workflow, then Starter (USD 16 monthly, 42 quarterly, 149 annual), Pro (35 / 74 / 269) and Max (89 / 199 / 699). Starter and Pro include tailoring, Swipe and List views, both agents and the Jobluvo inbox; Pro adds priority on fresh jobs. Max adds Auto Apply with up to five lanes, review before submit, standing instructions and agent tuning of lanes. Provisional allowances are 750, 1,750 and 5,000 applications a month. Agents are excluded from the free trial to keep model costs off unpaid accounts. Avoid charging separately for ordinary resume tailoring if affordable volume is the principal promise.

Do not publish exact Jobluvo allowances until the pilot measures the full cost distribution, including Workday-heavy users and failures. A marketing comparison must use equivalent billing periods, actual submission counts and relevant purchase channels.

```text
Monthly contribution = net recognized subscription revenue
                     - AI, browser, discovery, email and storage allocation
                     - variable support, fraud/refunds and referral costs

Maximum sustainable allowance ≈ application cost budget / measured cost per verified submission
```

Illustrative sensitivity only: a $15 monthly plan with 1,000 applications and a $4.50 execution budget requires average execution cost at or below $0.0045 per verified submission. This is arithmetic, not a demonstrated achievable cost or proposed final price. Lower price and more volume must pass this test before being promised.

Model web and mobile net revenue separately. Apple and Google payment requirements vary by storefront and program, so implement a shared entitlement layer and validate the applicable purchase flow before release. [Apple review guidelines](https://developer.apple.com/app-store/review/guidelines/), [Google Play payments policy](https://support.google.com/googleplay/android-developer/answer/9858738)

## 12. Nonfunctional requirements

| Area | Requirement / proposed launch target |
|---|---|
| Availability | 99.5% monthly availability target for core API and inbox; connector outages measured separately |
| Interaction speed | Cached discovery feed p95 under 2 seconds and locally acknowledged swipe actions; instrument by device/network |
| Durability | Durable workflows survive restarts, reviews and expired sessions without lost intent or blind resubmission |
| Isolation | User data, mail, browser state and secrets separated and access-tested across tenants |
| Security | Encryption in transit/at rest, secret vault, redacted logs, signed webhooks, least-privilege staff access |
| AI reliability | Structured outputs, evidence references, factual validators and a versioned regression corpus |
| Accessibility | Screen reader labels, text scaling, keyboard/button equivalents and reduced-motion support |
| Portability | Export profile, applications, generated documents and email records in documented formats |
| Recovery | Proposed RPO 1 hour / RTO 4 hours for core records, demonstrated with backup restoration drills |
| Observability | Trace each job selection through preparation, review, execution, receipt and billing without exposing secrets |
| Cost control | Per-task budgets, bounded retries, per-source throttles, worker limits and campaign-level accounting |

## 13. Release acceptance

Public launch requires the website and both mobile apps to complete the same tested workflow against the release-enabled destinations. A web demo or mock swipe feed alone does not satisfy the requested delivery.

Mandatory evidence:

1. Representative approved test cases across multiple employer configurations per advertised system, including long forms, uploads, duplicate applications and account recovery.
2. No unsupported facts or unapproved material edits in the release evaluation set.
3. Retry, network interruption and webhook replay tests show no duplicate submissions or double charges.
4. Managed email allocation, receipt, reply, attachment handling, OTP matching and account lifecycle operate across all clients.
5. Hard geography/authorization constraints, global pause and per-application approval hold under concurrent actions.
6. Actual source coverage, freshness, support limitations and failure outcomes are visible and match marketing claims.
7. Purchase, restore, cancellation and refund reconciliation work across channels.
8. Measured full-usage unit economics support the published price/volume combination.
9. User export/deletion, cross-user isolation, mobile release review and incident recovery are verified.

## 14. Decisions for the next review

These do not prevent engineering discovery or prototyping. They should be resolved before the dependent work is locked:

| Decision | Proposed default | Needed by |
|---|---|---|
| Meaning of “local execution” | LATAM localization and optional on-device runner tracked separately | Architecture review |
| Application email | Jobluvo-controlled domain; visible user-selected alias | Identity/email build |
| Mail after cancellation | Limited 90-day continuity plus export; never reuse addresses | Billing and lifecycle implementation |
| Review defaults | New accounts begin with review; Auto Apply is enabled explicitly and only on Max | Onboarding design |
| Lane limit and cap range | Five lanes, shared cap 1 to 150 per day | Auto Apply build |
| Launch system breadth | Three initial families plus validated Workday configurations | Release scope freeze |
| Existing inbox providers | Gmail first, Outlook next; provider approval assessed early | Integration planning |
| Price/volume | Choose after measured pilot costs | Paid beta |
| Resources and target date | Plan assumes a small dedicated cross-functional team | Scheduling |

The dashboard mockup is the first of these artifacts. The next should be a concrete onboarding, review, and application-detail prototype, accompanied by a working discovery-to-submission feasibility slice. The implementation plan defines their sequence and acceptance gates.
