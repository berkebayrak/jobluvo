# Jobluvo, Job parsing and ATS integration plan

Version 0.1, 12 September 2026. Engineering proposal covering job discovery and application execution on the 19 applicant tracking systems in Tsenta's disclosure, plus LinkedIn Easy Apply.

Companions: [Product BRD](01-Product-BRD.md), [Implementation plan](02-Implementation-Plan.md), [Dashboard mockup](03-Dashboard-Mockup.html), [Website](05-Website.html)

## 1. What this document decides

Jobluvo needs two separate capabilities for every platform: finding jobs (discovery) and submitting applications (execution). They are not the same problem, they have different legal and technical constraints, and a platform can be easy for one and hard for the other. Greenhouse, for example, publishes a clean listing API but requires an employer key to submit through the API, so submission goes through the hosted form instead.

This document sets, for each platform: how listings are pulled, how the application form is reached, whether a candidate account is needed, what bot defenses exist, and which coverage tier the platform belongs to at launch. It also sets Jobluvo's position on LinkedIn Easy Apply, where the honest answer is that no compliant server-side route exists.

Facts marked "observed" come from community reverse engineering rather than vendor documentation and can break without notice. Facts marked "unverified" could not be confirmed against a primary source and must be validated in the feasibility phase before any coverage claim is published.

## 2. Coverage tiers

| Tier | Meaning | Launch commitment |
|---|---|---|
| A | Documented public listing feed, hosted form without candidate account, adapter tested on multiple employers | Advertised as supported at launch |
| B | Listing feed exists but is observed or undocumented, or the form needs an account or OTP; adapter feasible but fragile | Enabled per validated employer configuration, shown as "supported for this employer" |
| C | No feed without employer credentials, or account plus multi-step wizard plus known bot defenses | Discovery where possible; execution as manual handoff until an adapter passes the benchmark |
| D | Automation prohibited by the platform's terms or no legitimate route | Save, resolve to another destination, or hand off to the user |

A platform's tier can differ between discovery and execution. The tables below state both.

## 3. Discovery architecture

### 3.1 Source registry

Every employer board is a row in the source registry: platform family, tenant identifier (board token, site slug, tenant and shard for Workday, company GUID for Paylocity), canonical careers URL, access method, refresh interval, allowed concurrency, health state, last successful fetch, active job count and a policy review flag.

The registry grows in three ways. Seeding from curated lists of US employers by platform, which is where the first few thousand boards come from. Fingerprinting: when a user pastes any careers URL or job link, the resolver detects the platform from the hostname or page markers (`boards.greenhouse.io`, `jobs.lever.co`, `myworkdayjobs.com`, `careers-*.icims.com`, and so on), extracts the tenant identifier and adds the board if it is missing. Cross-referencing: a job found on LinkedIn or an aggregator usually links to the employer's ATS page; the resolver follows that link once and registers the board.

There is no enumeration endpoint on any of these platforms. Jobluvo cannot ask Greenhouse for "all boards". Coverage is built board by board, which is why the registry is a product asset and why the "Add your own link" action in the Jobs tab feeds it.

### 3.2 Connector interface

Each platform family implements the same discovery contract:

```text
detectTenant(url) -> {family, tenantId, shard?, siteCode?} | null
listJobs(tenant, cursor?) -> {jobs: RawJob[], nextCursor?}
getJob(tenant, jobId) -> RawJobDetail
capabilities() -> {feedType, needsBrowser, rateLimit, supportsIncremental}
```

`RawJob` carries the platform's native fields untouched plus a content hash. Normalization into the canonical job schema (title, company, locations, workplace type, employment type, compensation, seniority signals, sponsorship signals, posted time, first seen, last checked, apply URL, destination family) happens in one shared step so parsing rules for US locations, pay ranges and sponsorship language live in one place, not nineteen.

### 3.3 Fetch modes

| Mode | Used for | Notes |
|---|---|---|
| Documented JSON API | Greenhouse, Lever, Ashby, SmartRecruiters, Gem, Workable widget | Cheapest and most stable. Conditional requests where supported. |
| Observed JSON endpoint | Workday, BambooHR, Breezy, Rippling, Oracle, UKG, ADP, Paylocity board | Same cost as a documented API but with a monitor that alerts on schema drift or auth changes. Each observed endpoint gets a contract test that runs daily against three reference employers. |
| Feed with employer-issued key | JazzHR XML, Jobvite XML, Paylocity feed v2 | Only when an employer or partner supplies the key. Not a general discovery route. |
| HTML parse | iCIMS, Zoho Recruit, Dover, Jobvite hosted pages | Needs a headless browser or careful HTML parsing; slowest and most fragile. Rate limited per domain. |
| User-supplied URL | Any | Resolves to one of the above or stores the job as unsupported with a handoff link. |

Polling intervals follow the implementation plan: priority boards every 2 to 5 minutes, long tail every 15 to 60 minutes, always once per board for all users, never per subscriber. Every fetch respects robots directives where they exist for the endpoint in question, uses an identifiable user agent, backs off on 429 and 5xx, and is paused automatically when the error rate for a family crosses a threshold.

### 3.4 Deduplication and freshness

The same requisition appears on the ATS board, the employer's careers site, LinkedIn and several aggregators. Jobluvo keys jobs by family plus tenant plus native job id, then links copies by requisition id when the platform exposes one, then by employer plus normalized title plus location plus a description similarity threshold. Posted time from the platform, first seen time and last checked time are stored separately, and a job is rechecked immediately before any submission because ATS listings close without notice.

## 4. Platform catalogue

### 4.1 Summary

| Platform | Listing access | Auth for listing | Form hosting | Candidate account | Known bot defense | Discovery tier | Execution tier |
|---|---|---|---|---|---|---|---|
| Greenhouse | Documented Job Board API | None | Hosted single page, or embedded in employer site | No (optional MyGreenhouse) | Invisible reCAPTCHA, optional email code | A | A |
| Lever | Documented Postings API | None | Hosted single page | No | hCaptcha on suspicious traffic | A | A |
| Ashby | Documented Job Posting API | None | Hosted single page, JS rendered | No | Spam protection with employer-set strictness | A | A |
| SmartRecruiters | Documented Posting API | None, if employer enabled public feed | Hosted | Optional (unverified) | None documented | A | A |
| Workable | Public widget API (semi-documented) | None | Hosted | No | None documented | A | B |
| Gem | Documented job board API | None | Hosted on jobs.gem.com | Unverified | None documented | A | B |
| BreezyHR | Observed `/json` endpoint | None | Hosted | No (unverified) | None documented | B | B |
| BambooHR | Observed careers list and detail JSON | None | Hosted | No (unverified) | None documented | B | B |
| Rippling | Observed board API; official API docs exist but not confirmed | None observed | Hosted on ats.rippling.com | No (observed) | None documented | B | B |
| Workday | Observed CXS JSON endpoint per tenant | None | Tenant site, multi-step wizard | Yes, with email verification | None documented; account gate | B | B |
| Oracle Recruiting Cloud | Observed CE REST endpoint | None observed | Hosted candidate experience, multi-step | Email OTP instead of password | OTP gate | B | B |
| UKG Pro | Observed search endpoint | None | Hosted job board | Typically yes (unverified) | None documented | B | C |
| Paylocity | Public board with embedded JSON; feed v2 needs employer GUID | None for board | Hosted | Unverified | None documented | B | C |
| ADP Workforce Now | Observed SPA endpoints | None observed | Hosted career center, wizard | Yes | None documented; account gate | B | C |
| iCIMS | HTML portals, internal JSON undocumented; partner API gated | None for HTML | Hosted or iframed, multi-step | Yes | Per-domain rate limits, CDN protection | C | C |
| JazzHR | Per-account XML feed with employer key; HTML careers pages | Key for feed | Hosted on applytojob.com | No (unverified) | None documented | C | B |
| Jobvite | Opt-in XML or RSS feed keyed by company id; HTML pages | Opaque id, opt in | Hosted apply page | Unverified | None documented | C | C |
| Dover | Careers page HTML; API needs employer key | Key for API | Hosted on app.dover.com | No (unverified) | None documented | C | B |
| Zoho Recruit | JSON embedded in careers HTML | None | Hosted, customizable form | Optional candidate portal | None documented | C | C |
| LinkedIn Easy Apply | Not applicable | Not applicable | LinkedIn modal | LinkedIn account | Behavioral detection, policy prohibits automation | D | D |

### 4.2 Platform notes

**Greenhouse.** Listings come from `GET https://boards-api.greenhouse.io/v1/boards/{board_token}/jobs?content=true`, with `/jobs/{id}?questions=true` returning the exact form questions, which lets the preparation step build the packet before a browser ever opens. The API POST for applications requires the employer's Job Board API key, so Jobluvo submits through the hosted form at `job-boards.greenhouse.io/{token}/jobs/{id}`. Greenhouse ships invisible reCAPTCHA on all embedded integration options and lets employers raise spam sensitivity or demand an email verification code. The adapter must treat a CAPTCHA challenge as a user handoff, never as something to solve, and route verification codes through the managed inbox. Roughly one in six large US employers uses Greenhouse. Source: developers.greenhouse.io/job-board, support.greenhouse.io articles on careers page integration and invisible reCAPTCHA.

**Lever.** `GET https://api.lever.co/v0/postings/{site}?mode=json` (EU tenants on `api.eu.lever.co`) lists jobs without auth. Application POST needs an employer Super Admin key, so the hosted form at `jobs.lever.co/{site}/{id}/apply` is the route. Lever shows hCaptcha on the location field to traffic it considers suspicious, which argues for realistic per-session pacing and residential-quality egress rather than datacenter bursts. Source: github.com/lever/postings-api, help.lever.co on application form configuration.

**Ashby.** `GET https://api.ashbyhq.com/posting-api/job-board/{name}?includeCompensation=true` returns listings with `applyUrl`. The `applicationForm.submit` endpoint needs an employer key with `candidatesWrite`, so execution uses the hosted, JavaScript-rendered form at `jobs.ashbyhq.com/{org}/{id}/application`. Ashby documents spam protection with employer-selectable strictness (None, Permissive, Less permissive, Strict). The mechanism is not published; the adapter records the strictness outcome per employer and downgrades the employer to review-only when submissions start bouncing. Source: developers.ashbyhq.com, docs.ashbyhq.com on application spam protection.

**SmartRecruiters.** `GET https://api.smartrecruiters.com/v1/companies/{company}/postings` is unauthenticated when the employer has enabled the public feed. Published limits are about 10 requests per second and 8 concurrent, with 429 on excess. Posting an application needs an API or partner key, so execution uses the hosted page `jobs.smartrecruiters.com/{Company}/{postingId}`. Screening questions are also retrievable per posting for pre-building answers. Source: developers.smartrecruiters.com.

**Workable.** The widget API at `https://apply.workable.com/api/v1/widget/accounts/{account}?details=true` returns listings without auth and is widely used, though it is documented as a widget rather than a public feed and should be watched for changes. The hosted form at `apply.workable.com/{account}/j/{shortcode}/apply` needs no account. Workable supports LinkedIn Apply Connect on the employer side, which matters for section 6. Sources: dev.to integration write-up, jobseekers.workable.com application process article, help.workable.com on Apply Connect.

**Gem.** `GET https://api.gem.com/job_board/v0/{vanity_path}/job_posts/` is documented in Gem's help center without an auth requirement. Forms are hosted on jobs.gem.com and are not customizable through an API, so execution is form automation. Small footprint today. Source: help.gem.com on the job board API.

**BreezyHR.** `https://{company}.breezy.hr/json` returns positions without auth. It is observed rather than documented; the official v3 API needs an employer token. Hosted form at `{company}.breezy.hr/p/{id}/apply`. Around two thousand companies. Source: theirstack.com survey of public posting APIs, help.breezy.hr on embedding.

**BambooHR.** `https://{company}.bamboohr.com/careers/list` and `/careers/{id}/detail` return JSON without auth, observed. Hosted single-page form. Mostly small and mid-sized employers. Source: jobspipe.dev guide, documentation.bamboohr.com for the authenticated ATS API.

**Rippling.** Rippling publishes a Recruiting Job Board API page at developer.rippling.com but its content could not be fetched, so the exact endpoint and auth are unverified. Community tools use `https://ats.rippling.com/api/v2/board/{slug}/jobs?page=0&pageSize=100` without auth. Hosted forms on ats.rippling.com appear to be single page without an account. About 1,300 companies. Validate the official docs in phase 0. Source: OpenPostings discussion, fantastic.jobs.

**Workday.** No documented public listing API. Every tenant site at `https://{tenant}.wd{N}.myworkdayjobs.com/{site}` loads from `POST .../wday/cxs/{tenant}/{site}/jobs` with a JSON body of facets, `limit` (20 maximum, larger values silently return nothing) and `offset`; detail is `GET .../wday/cxs/{tenant}/{site}{externalPath}` with `Accept: application/json`. The shard number is not predictable and must be read from a real job link. Execution requires a candidate account per tenant (email verification on creation), then a multi-step wizard: My Information, My Experience with resume parsing, Application Questions, Voluntary Disclosures, Self Identify, Review, Submit. Employers customize the steps, so the adapter needs per-tenant configuration and the BRD's "validated configurations only" rule. Workday is used by roughly 40 percent of the largest US employers, which is why it is worth this effort. Source: dev.to write-ups on the CXS endpoint, university applicant guides for the wizard, Jobscan and ResumeAI ATS share reports.

**Oracle Recruiting Cloud.** Career sites call `GET https://{host}/hcmRestApi/resources/latest/recruitingCEJobRequisitions?finder=findReqs;siteNumber={CX_n}` anonymously in practice; Oracle documents only the internal sibling endpoint as authenticated, so anonymity of the CE variant is observed. Applying uses an emailed one-time code instead of a password, then a multi-step flow that employers can shorten with Oracle's "Easy Apply Flow". The OTP lands in the managed inbox, so the OTP matching rules in the BRD (expected employer, transaction, time window) apply directly. About 7 percent of large employers. Source: OpenPostings discussion, docs.oracle.com on Easy Apply Flow and Apply Connect.

**UKG Pro (UltiPro).** Boards at `https://recruiting.ultipro.com/{companyCode}/JobBoard/{boardGuid}/` load results through an observed `POST .../JobBoardView/LoadSearchResults`. The official job board API is per-integration and authenticated. Boards expose an account login and appear to require candidate accounts (unverified). Execution stays at tier C until the account and wizard flow has been mapped on reference employers. Source: OpenPostings discussion, developer.ukg.com.

**Paylocity.** The public board at `recruiting.paylocity.com/recruiting/jobs/All/{companyGuid}/{slug}` is JavaScript rendered with the listing JSON embedded in `window.pageData`. The documented Job Feed v2 at `/recruiting/v2/api/feed/jobs/{guid}` needs an employer-issued GUID. Apply URLs follow `/recruiting/Jobs/Apply/{jobId}/{company}/{title}`; account requirements are unverified. Source: recruiting.paylocity.com feed documentation, OpenPostings.

**ADP Workforce Now.** Career centers at `workforcenow.adp.com/mascsr/default/mdf/recruitment/recruitment.html?cid={guid}&ccId={id}` are single-page apps; the MyJobs variant exposes observed endpoints under `myjobs.adp.com/public/staffing/v1/`. Applicants must register an account, then complete a wizard with resume and up to ten documents. Tier C for execution until mapped. Source: OpenPostings, an employer FAQ on ADP applications.

**iCIMS.** Portals at `careers-{company}.icims.com/jobs/search?ss=1` (add `in_iframe=1` for the bare view) render from undocumented internal JSON; the official APIs sit behind the iCIMS partner program with a customer sponsor. Applying requires a candidate profile, resume parsing, screening and EEO questions, often inside an iframe on the employer's site. Per-domain rate limits and CDN abuse protection are reported. Around 14 percent of a broad employer sample, so it matters, but it is the hardest of the large three. Source: jobspipe.dev, developer-community.icims.com, applicant guides.

**JazzHR.** Listings are exposed as a per-account XML feed configured by the employer, cached 24 hours, or through an account-keyed REST API. Public discovery therefore falls back to parsing `{company}.applytojob.com` pages. The hosted form does not appear to need an account. JazzHR's Custom Apply API is for partners. Source: success.jazzhr.com, apidoc.jazzhrapis.com.

**Jobvite.** Hosted pages at `jobs.jobvite.com/{company}` are HTML. XML and RSS feeds exist but require an opaque company id and are opt-in, and most employers never enable them. Apply pages are Jobvite-hosted; account behavior unverified. Source: careers.jobvite.com integration page, jobspipe.dev.

**Dover.** Careers pages live at `app.dover.com/jobs/{company}`; the API needs an employer app key. Around 350 companies, so HTML parsing on demand is enough. Source: help.dover.com.

**Zoho Recruit.** Career sites at `{org}.zohorecruit.com/jobs/Careers` embed the job list as JSON in a hidden input, observed. Forms are employer-customizable and may sit behind an optional candidate portal. Official API is OAuth per organization. Source: OpenPostings, zoho.com career site page.

## 5. Execution architecture

### 5.1 One form engine, many adapters

The application runner is a Playwright worker with a per-family adapter that implements the interface from the implementation plan: `identifyDestination`, `inspectPosting`, `inspectForm`, `establishSession`, `prepareFields`, `uploadDocuments`, `validatePreparedState`, `submit`, `collectEvidence`, `reconcileResult`.

Adapters are split into three shapes because the platforms cluster that way:

| Shape | Platforms | What the adapter does |
|---|---|---|
| Single-page hosted form | Greenhouse, Lever, Ashby, SmartRecruiters, Workable, Breezy, BambooHR, Gem, JazzHR, Dover, Rippling | Inspect fields once, fill from the packet, upload resume, answer screening questions, hold before submit if review is on, submit, capture confirmation page |
| Account plus wizard | Workday, ADP, iCIMS, UKG | Create or reuse an employer account with the Jobluvo address, complete email verification through the inbox, walk configured steps with a checkpoint after each, hold on the Review step if review is on, submit, capture confirmation |
| OTP plus flow | Oracle | Request the code, match it in the inbox against the open transaction, complete the flow, hold on review, submit |

Field mapping is deterministic first: each family has a tested map of known labels to packet fields. Unknown labels go to a constrained model call that returns a packet field or "unknown", and unknown is a hard stop that routes to the user (BR-02 in the BRD). Demographic, disability and authorization answers are never inferred (APP-05).

### 5.2 What "review before submit" means per family

The BRD promises that review-before-submit holds the application on sites that support pausing and submits as usual elsewhere. Concretely: single-page hosted forms can always be filled and held, because nothing is committed until the final button. Wizards can be held on their Review step, but employer sessions expire, so the hold has a time limit after which the runner releases the browser and re-fills on resume (the implementation plan already requires revalidation on resume). Oracle's OTP has its own expiry, so a held Oracle application may need a fresh code on resume; the user sees this as one extra wait, not a failure.

### 5.3 Bot defenses and how Jobluvo behaves

Jobluvo does not solve CAPTCHAs, does not rotate identities to evade detection, and does not use residential proxy networks to disguise traffic. When Greenhouse's reCAPTCHA, Lever's hCaptcha, Ashby's spam filter or any other challenge appears, the runner captures the state, notifies the user, and offers a handoff where the user completes the challenge in a short-lived session. Pacing is human-like because that is what the platforms tolerate, not to hide anything: one application at a time per employer, spaced submissions, and a per-employer daily ceiling.

Employers that repeatedly reject or challenge submissions get their configuration flagged and moved to review-only, and the coverage matrix shown to users updates accordingly (OPS-02).

### 5.4 Evidence and reconciliation

Every submission stores the confirmation page, the confirmation email when it arrives, the exact packet hashes and the destination job snapshot. A timeout after clicking Submit puts the application into verification-pending and the reconciliation job looks for the confirmation email before deciding anything. This is the same protocol as the implementation plan; the ATS-specific part is knowing what a success looks like on each family (Greenhouse's "Application submitted" page, Workday's "Thank you" with a candidate home entry, and so on), which is a fixture per family.

## 6. LinkedIn Easy Apply

### 6.1 The constraints

LinkedIn's User Agreement prohibits software, scripts, bots, browser plugins and extensions that scrape the service or automate activity on it, and its help center states that third-party extensions that automate or scrape are not permitted and can lead to account restrictions. There is no API through which a job seeker or a consumer product can submit an Easy Apply application. LinkedIn's Apply Connect and Apply with LinkedIn programs are for ATS vendors and employer customers: jobs sync from the ATS to LinkedIn, candidates apply inside LinkedIn, and applications flow back to the ATS. The Job Posting API is partner-only and, at the time of writing, not accepting new partners.

Existing auto-apply tools handle Easy Apply either with a Chrome extension acting inside the user's logged-in session or with scripted browsers against the DOM. Reported consequences for detected automation range from warnings to temporary restrictions, identity verification and permanent account restriction, with detection based on timing regularity, velocity and known extension signatures. None of this is officially documented, but the risk sits with the user's LinkedIn account, which is an asset Jobluvo must not gamble with.

### 6.2 Jobluvo's position

Jobluvo does not automate LinkedIn from the cloud, ever. There is no compliant route, and running a user's LinkedIn session from Jobluvo servers would violate the User Agreement on the user's behalf and expose the user's account. This is a hard rule in the same class as BR-12.

What Jobluvo does instead, in order of preference:

1. **Resolve to the employer's ATS.** Most Easy Apply postings also exist on the employer's own ATS, because the job was synced there from Greenhouse, Workday, Oracle, Workable or another system through Apply Connect or a job wrapping feed. When a user saves or pastes a LinkedIn job URL, the resolver reads the employer name and title, searches the source registry and the live feeds for the same requisition, and applies there. This is the default path and the one Jobluvo measures: target at least 60 percent of saved LinkedIn jobs resolving to a supported destination in the pilot, and publish the actual number.
2. **Register the board when it is new.** If the employer is on a supported platform but not yet in the registry, the resolver registers the board from the link, so the next user gets it for free.
3. **Assisted apply in the user's own browser, opt in, later.** A browser extension (expansion scope in the BRD) can prefill the Easy Apply modal from the user's Jobluvo profile while the user is present and clicks Submit. This is autofill, not automation, and it is how comparable products currently operate. It still touches LinkedIn's extension policy, so it launches only after a legal review, with a plain risk disclosure, with the user clicking every Submit, and with no background operation. It is not part of the core launch.
4. **Honest handoff.** When neither resolution nor the extension applies, the job is saved with a "Apply on LinkedIn" state, the tracker holds a place for it, and the user can mark it applied manually. The Career coach can still prepare the answers and resume for it.

Marketing must not describe any of this as LinkedIn Easy Apply support. The correct claim is that Jobluvo finds the employer's own application page for most LinkedIn jobs and applies there. The website's FAQ and the blog post on LinkedIn already use this wording; keep them consistent with this section.

### 6.3 Resolver design

The LinkedIn resolver takes a job URL or a shared link, extracts the employer name, title, location and posting date from the public page or from the user's pasted text, and matches against the canonical job inventory using the deduplication rules from section 3.4. A match above the confidence threshold is presented to the user as "Found the same role on {employer}'s careers site" with both links visible, and the user confirms once. Below threshold, the user sees the candidates and picks, or marks it as LinkedIn only. Confirmed resolutions train the matcher.

## 7. Rollout

| Phase | Discovery | Execution |
|---|---|---|
| 0. Feasibility (weeks 1 to 2) | Registry seeded with 300 employers across Greenhouse, Lever, Ashby; Workday CXS spike on 10 tenants; contract tests for every observed endpoint | One end-to-end flow on Greenhouse with evidence; Workday wizard mapped on 3 tenants, not enabled |
| 1. Foundation (weeks 3 to 5) | Tier A families live; SmartRecruiters and Workable added; LinkedIn resolver v1 | Greenhouse, Lever, Ashby adapters at tier A benchmark |
| 2. Engine (weeks 4 to 9) | Tier B observed feeds live with drift monitors; Oracle and UKG discovery | Workday enabled per validated configuration; Oracle OTP flow; SmartRecruiters, Workable |
| 3. Clients and mail (weeks 6 to 12) | HTML parsers for iCIMS, Zoho, Jobvite, Dover behind rate limits | Breezy, BambooHR, Rippling, Gem, JazzHR adapters |
| 4. Paid beta (weeks 11 to 16) | Registry past 5,000 boards; coverage matrix published in product | ADP, iCIMS, UKG adapters if benchmark passes; otherwise manual handoff stays |
| Expansion | Employer-suggested boards, aggregator resolution | Assisted-apply extension after legal review |

Publish denominators with every coverage claim: boards registered, jobs discovered, jobs on supported destinations, attempted submissions, verified submissions, challenges, unsupported and unknown outcomes.

## 8. Validation

| Area | Cases |
|---|---|
| Discovery | Board token typo, tenant moved shard, employer disabled public feed, 429 storms, schema drift on an observed endpoint, job closed between fetch and submit |
| Forms | Custom questions added mid-application, required document type not in packet, dropdown with unmatched option, employer-specific Workday step order, iframe-embedded iCIMS |
| Accounts | Existing Workday account with different email, verification email delayed, OTP reused, session expired on held review |
| Defenses | reCAPTCHA triggered on first submission, hCaptcha on location field, Ashby strict mode rejection, iCIMS rate limit |
| LinkedIn | URL with tracking parameters, job present on two ATSes, employer not in registry, resolution below threshold, user marks LinkedIn-only |
| Evidence | Submit timeout with later confirmation email, confirmation page without email, duplicate confirmation emails |

## 9. Risks specific to this plan

| Risk | Response |
|---|---|
| Observed endpoints change without notice | Daily contract tests on reference employers, drift alerts, HTML fallback per family, family kill switch |
| Bot defenses tighten on tier A platforms | Human-like pacing, per-employer ceilings, user handoff for challenges, review-only downgrade; never evasion |
| Workday configuration variance exceeds capacity | Enable per validated tenant only; publish the list; prioritize by user demand |
| LinkedIn resolution rate is low for some sectors | Measure by sector, expand registry where gaps appear, keep the handoff honest |
| Extension policy risk for assisted apply | Legal review before build; user-present only; feature can ship late or not at all without affecting core value |
| Coverage claims outrun reality | Product shows the coverage matrix and per-employer support state; marketing copy is generated from the same data |

## 10. Decisions needed

| Decision | Proposed default | Needed by |
|---|---|---|
| Launch family set | Greenhouse, Lever, Ashby at tier A; SmartRecruiters and Workable next; Workday per configuration | Scope freeze |
| Egress and identity | Datacenter egress with identifiable user agent and honest pacing; no residential proxies | Architecture review |
| Assisted-apply extension | Deferred to expansion pending legal review | Roadmap |
| LinkedIn resolution threshold | Auto-confirm above 0.9, ask between 0.6 and 0.9, LinkedIn-only below | Resolver build |
| Observed endpoint policy | Allowed with contract tests and kill switch; documented in the coverage matrix as "best effort" | Phase 0 exit |
