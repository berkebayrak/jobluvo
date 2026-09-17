# Jobluvo, decision log

Decisions taken during build that the other documents assume but do not state. Newest first. Each entry says what was decided, what it was measured against, and what it forbids.

Companions: [Product BRD](01-Product-BRD.md), [Implementation plan](02-Implementation-Plan.md), [ATS integration plan](04-Job-Parsing-and-ATS-Integration.md)

## 17 September 2026

### D-014. Extraction per user: USD 0.0022, the PDF sent as a file, no parser dependency

The third term of the cost per application (D-011), measured on this date with `npm run extract-sample`: Jack Miller's resume, rendered from his seeded facts by `npm run resume-pdf` so the extractor has a ground truth, sent five times as the PDF and five times as plain text to gpt-5.6-luna, reasoning off, strict JSON of the facts with the resume's own words as evidence for each.

| Input | Input tokens | Output tokens | USD, first call | USD, repeat |
|---|---|---|---|---|
| PDF as a file | 1,605 | 1,430 to 1,545 | 0.00218 | 0.00175 to 0.00189 |
| Plain text | 1,546 | 1,545 | 0.00216 | 0.00189 |

The product path is the first call: one resume, once per user, nothing to repeat. So extraction per user is USD 0.0022. The API reads the PDF as text, 59 tokens more than the text itself, so a PDF parser would save nothing and none was added; the file goes to the model as it is. Output is 85 percent of the bill, because the facts come back in full with their evidence, and that is the point of the call.

What it read back, five of five runs the same: 4 of 4 roles with their dates, 18 of 18 bullets word for word, 16 of 16 skills, 2 of 2 answers, contact and link. 1 of 2 degrees differed from the seed by reading the resume line literally, "MBA, Executive MBA, part time" as the degree, which is what the line says. The extractor copies; it does not tidy.

Nothing extracted is read until confirmed (ID-03). The confirmation screen lists every extracted fact with its evidence, Confirm and Reject per line, and Confirm all, which confirms the document's facts and retires the confirmed resume facts before it as rejected, never deleted (DOC-06). Preference, authorization and sponsorship facts are the user's own answers and are never touched. Jack's seeded resume facts were replaced this way on this date: 26 confirmed from the upload, 24 seeded now rejected. With the facts hash moved, the scoring cron reworks his scored matches on its next run and the packets built on the old facts read as stale.

### D-013. Tailoring is a change set, not a document: USD 0.00054 per packet, 55 percent of the whole document, with the validator as the guarantee

The second term of the cost per application (D-011), measured on this date with `npm run tailor-sample` over the same 100 jobs as the scoring sample, on gpt-5.6-luna, reasoning off. The facts message, every confirmed fact with an id, was 4,638 characters, 42 facts, about 1,160 tokens; the cached block, instructions plus facts, was 1,521 tokens on every call after the first.

| Mode | Calls | Output p50 | USD p10 | USD p50 | USD p90 | USD mean | USD max | Per packet |
|---|---|---|---|---|---|---|---|---|
| Change set, shipped | 101 for 100 packets | 322 | 0.000268 | 0.000570 | 0.000665 | 0.000533 | 0.000710 | 0.000538 |
| Whole document | 100 | 648 | 0.000893 | 0.000963 | 0.001049 | 0.000969 | 0.001201 | 0.000969 |

The model emits only the edits, which bullet is replaced, by what text, citing which facts, plus an optional top line and a skill order, and the code assembles the document. Five edits per packet on average. That halves the output tokens and costs 55 percent of the whole document, and the diff the review screen needs (DOC-03) is the change set itself rather than a comparison of two long strings afterwards. By length the change set runs USD 0.000436 short, 0.000513 medium, 0.000624 long.

The validator is not a cost device. It is what makes "nothing is added that is not on your profile" true: both sides are normalised (eight and 8, USD 2.3M and 2.3 million, Jan 2023 and January 2023, twenty five and 25), every number, amount, percentage and date in a proposed line must appear in some confirmed fact or the packet is rejected, one retry with the findings, then stored as invalid rather than passed. A wrong citation, a name in no fact, an edit to a line that does not exist are soft and travel with the packet. Arithmetic over facts is a new claim: four managers and two analysts is not a team of six on the profile. On the sample: 100 of 100 packets ready in each mode, 1 retry whose first answer carried a hard finding and whose second passed, 0 stored invalid; soft findings on the stored attempts were 8 uses of KPI, a term on no fact; 3 name findings on the model's summary line that were the tokeniser's own doing, it stripped the commas from "PMO, OKR" and "SQL, Power BI" and joined the neighbours into one name, plus one plural, "PMOs"; and 5 citations that did not carry the value they were cited for. The tokeniser now ends a name at a comma, semicolon or slash and a plural of a known name is known; a run of known words is still looked up whole, so two known words run together stay flagged. The 5 wrong citations were one pattern: "managing six strategy managers and analysts" on R1.1, which is four managers and two analysts added together. The value 6 is on the profile elsewhere, so the hard rule passed it and only the citation check saw it; it stays soft by the rule as agreed, and the rate is tracked from here per sample, on the packets each run tags: 5 of 520 cited edits, 0.96 per 100. When the validator fires on a legitimate rephrasing the normaliser is fixed; the rule is never loosened.

With this term the function of D-011 reads: cost per application = scored per applied x 0.000311 + 0.000538 + extraction per user amortised.

| Scored per applied | Scoring plus tailoring, USD | Of the band's low end | Of the band's high end |
|---|---|---|---|
| 5 | 0.0021 | 60 percent | 33 percent |
| 8 | 0.0030 | 87 percent | 47 percent |
| 10 | 0.0037 | 104 percent | 57 percent |
| 20 | 0.0068 | 193 percent | 106 percent |

Tailoring is a small, fixed term. The ratio is the number, and the cheap pre rank that D-012 records is on the critical path for the business case, not a later optimisation. What remains unmeasured is extraction per user, the upload branch. The candidate models for tailoring (D-001) are priced in the table; only luna was run.

### D-012. Nothing is scored that a user will not see

The scored per applied ratio is the largest unknown in the cost per application (D-011) and it is not measurable until there are users. It is controllable. The hard filter costs nothing and already removes about sixty percent of the inventory before any claim. From here the rule for whatever drives scoring, the daily cron today and the feed later, is that a job is scored only if this user would be shown it: it passes the user's hard filter, it is the group's representative for the user, it is not swiped, and it is fresh or on the rework list. A score for a job the user never sees is a paid call with no application behind it.

The cache order is a lever that follows the same volume question. The cache on this model serves a whole repeated message (D-010), and which message repeats depends on the shape of the batch. Today one user is scored against many jobs, so the profile is the repeated message and goes first; that is the shipped order and it halves the call (D-011). At scale the batch may be the other way round, one fresh job scored for many users, and then the job is the repeated message and would go first. The order may need choosing per batch: put first whichever message the batch repeats. The code carries both orders for that reason, not only for the sample.

What it forbids: scoring the backlog (D-004 already), scoring every member of a group, scoring ahead of the filter, any prefetch of scores for jobs outside the user's feed, and a fixed prompt order that ignores which message the batch repeats.

### D-011. Measured cost per scoring call: USD 0.00031 mean with the profile cached, USD 0.00057 without

The number phase 0 exists to produce (D-002), measured on this date with `npm run score-sample` over 100 of the demo user's passing jobs, drawn round robin over 67 cells of family, seniority and description length, scored twice on gpt-5.6-luna with reasoning off and a strict JSON output of one integer and at most seven short lines. The profile message was 4,750 characters, about 1,190 tokens: four roles with their own bullet lines, two degrees, sixteen skills and two standing answers, the size extraction produces from a ten year resume. The cached message, instructions plus profile, was 1,444 tokens.

| Run | Calls | Input p50 | Cached p50 | Output p50 | USD p10 | USD p50 | USD p90 | USD mean | USD max |
|---|---|---|---|---|---|---|---|---|---|
| Profile first, its own message | 100 | 2,200 | 1,444 | 108 | 0.000241 | 0.000308 | 0.000383 | 0.000311 | 0.000451 |
| Job first, nothing cached | 100 | 2,200 | 0 | 108 | 0.000503 | 0.000564 | 0.000641 | 0.000573 | 0.000706 |

The cached order costs 54 percent of the uncached one. By description length the shipped order runs USD 0.000239 for short, 0.000300 for medium and 0.000376 for long postings; by family Gem 0.000265, Lever 0.000299, Greenhouse 0.000312, Ashby 0.000317. Seniority makes no difference beyond length. Output tokens are 108 of 2,200, so output is no longer the bill; the job text is.

What it is: a term in the number, not the number. A scoring call is paid per job scored, and a user applies to one of several jobs scored, so

    cost per application = scored per applied x USD 0.000311 + tailoring per application + extraction per user amortised over the user's lifetime

Tailoring and extraction are unmeasured on this date. The scoring term alone against the USD 0.0035 to 0.0064 budget band, USD 0.0045 target:

| Scored per applied | Scoring term, USD | Of the band's low end | Of the band's high end |
|---|---|---|---|
| 5 | 0.0016 | 44 percent | 24 percent |
| 8 | 0.0025 | 71 percent | 39 percent |
| 10 | 0.0031 | 89 percent | 49 percent |
| 20 | 0.0062 | 178 percent | 97 percent |

At eight scored per applied the scoring term takes most of the low end before a single tailored resume; at twenty it is over budget on its own. The ratio cannot be measured without real users. It can be controlled: the hard filter is free and already removes about sixty percent of the inventory, and nothing is ever scored that a user will not see (D-012). An earlier run under the same tag date, `sample-2026-09-17-prefix`, measured the single message layout and got 0 cached tokens; its rows stay in cost_events as the record behind D-010.

### D-010. The scoring prompt is two messages, the profile first as its own message, because the cache hits whole messages

The cost study's optimised figure assumes the profile, identical for every job scored for one user, is served from the cached input tier at a tenth of the fresh rate. On gpt-5.6-luna that only happens when the profile is its own message. Measured on this date with the demo profile of about 1,440 tokens after the instructions: with the profile and the job in one user message, profile first, 0 cached tokens on every call, including a call whose text differed from the previous one by four words at its very end, while an identical repeat was served with all but 3 of its 2,171 tokens cached. With the profile as a developer message before the job's user message, 1,440 cached tokens on every call after the first, sequential or five at once. Putting the profile inside the instructions gives the same 1,440. So the cache on this model is keyed on whole messages that repeat, not on a token prefix, and the shipped prompt is instructions, then the profile as one message, then the job as one message.

What it forbids: anything that varies per job inside the profile message, and any layout that puts job text before the profile. The job first order exists in the code only so the sample can measure the difference (D-011).

### D-009. The apply URL allowlist is keyed on the parameter name, not on the source family

The normaliser keeps only the query parameters that identify a job and drops everything else. That was decided on the first live run, when a denylist stripped gh_jid and collapsed 650 Stripe jobs into 89 groups, and it stands: an allowlist, not a denylist. What changes is the key. The list was keyed on the family of the source that saw the URL, so gh_jid survived only when a Greenhouse adapter handed the link over. A copy of the same posting arriving through any other family dropped it, and every Stripe job seen from such a board would have normalised to https://stripe.com/jobs/search, the same collapse the allowlist was introduced to stop, waiting for the first syndicated board. gh_jid only ever appears on a Greenhouse embedded page, whichever board links to it, so keeping it wherever it appears is correct. The list is now one set of parameter names and the normaliser takes no family.

Measured before it shipped, on this date, over the 1,948 jobs in the database: the url rule had never fired (0 of 335 links) because no two open jobs share a normalised URL and all three Greenhouse boards, Stripe, Datadog and Airbnb, are employer hosted with gh_jid, so the rule had no pair. The feed form and a tracked syndicated form of one real posting per board normalise to the same string under the Greenhouse family, and to different strings under any other family or none. Under the new rule 0 of 1,948 stored values change, because only Greenhouse rows carry the parameter, and still no two open jobs share a normalised URL.

### D-008. A group split path is a production requirement, due before the registry grows

Changing a dedupe rule makes existing groups wrong, and nothing in the code can unpick them. `linkChanged` only links jobs that have no group, `attach` leaves two jobs that already sit in different groups alone, and there is no path that removes a link or splits a group. The rule change measured in D-006 and D-007 would not make 17 of the 48 similarity merges that existed on this date, and all 17 stayed merged until the tables were reset.

An earlier note concluded that no split path was needed. That was measured against the gutted description cores, where the question was whether past merges were wrong on their own terms. It did not cover a rule change, and it is now wrong.

Not built in phase 0. Phase 0 data is disposable and a reset costs one whole board re-poll. This stops being true the moment there are real users: a reset would destroy swipe history, applications and inbox threads, so from that point a rule change needs a split path that re-evaluates existing groups, moves members out, and carries each member's swipe decisions and matches with it. Due before the registry grows beyond the seed boards.

### D-007. A conflicting requisition id refuses a similarity merge, within one family only

Two postings of the same company and title, with similar descriptions, are not merged when both carry a requisition id that identifies a real requisition and the two ids differ. A requisition id counts only when it carries a digit and is at most 40 characters, which drops placeholders such as Airbnb's "ONE" and "MULTI" and Stripe's "See Opening ID".

The rule applies only when both postings come from the same family. A board numbers its own requisitions, so two different ids from one board are the employer saying two openings. Two ids from different boards are two unrelated schemes, and reading a difference into them would refuse exactly the syndication merge the similarity rule exists to make.

Measured before it shipped, over the 48 similarity merges that existed on this date: 40 carried an id on both sides, 18 of those differed, all 18 were Greenhouse against Greenhouse, all 18 survived the placeholder guards, and the guards saved none. Mostly one Datadog sales role posted once per US territory.

### D-006. Location overlap compares the country, and remote is treated as possibly country restricted

Two locations are the same place only if their countries agree. Below that gate the finest shared level decides: city, then region, then the country itself when neither side names anything finer, then the raw string when neither side names a country. A country given as a name the code table did not resolve is an unknown country, never a different one, so it never fails the test.

Two remote roles that each name a country and share none of them do not overlap. "Remote, United States" and "Remote, Germany" are what a company posts when it wants a person in each. A remote role that names no country is unrestricted as far as the feed says and still overlaps anything remote.

Measured before it shipped, over the 546 logged similarity pairs: of the 301 pairs at or above the 0.85 threshold that failed only on location, the new rule released 0 and kept 301 apart, which reading the highest scoring ones confirms as correct, since they are one description posted in New York and Paris, Boston and New York, Seoul and Mexico City. In the other direction it would withhold 10 of the 48 existing merges, all cross country remote. See D-008 for what that means for groups that already exist.

### D-005. The job tables were reset and re-ingested under the new dedupe rules

Rather than leave 17 wrong groups in place or build a split path in phase 0. `cost_events` was kept: it holds the ingest timings, which are the only history in this database worth anything, and it has no foreign key into jobs. Profile facts are in `profile_facts` and were untouched. `npm run db:reset` no longer truncates `cost_events`.

### D-004. The scoring cron is the only thing that scores. There is no request time model call

Scoring claims jobs first seen in the last 24 hours that pass the hard filter, plus rework rows. The backlog is never bulk scored. A backlog job is not scored when a user reaches it in the feed either: an unscored card renders as unscored, which the card already supports.

A model call inside a feed request buys latency and an unbounded cost path in exchange for polish that measures nothing. If the backlog matters later it becomes a queue, never a request time call. Settled, not to be reopened.

### D-003. Cost per application is measured from a stratified sample, not from the cron

The daily fresh slice is too small to measure anything. Measured on this date over the last 14 days of board posting dates: 345 postings arrived, about 25 a day, of which 139 passed the demo user's hard filter, about 10 a day. By family over that window, Greenhouse 220 fresh and 107 passing, SmartRecruiters 71 and 0, Ashby 37 and 28, Lever 12 and 4, Workable 5 and 0. A 24 hour cron would need a week to reach 70 calls and the distribution would be Greenhouse shaped.

So the measurement is a one off script over a sample of about 100 jobs spread across families, seniorities and description lengths. It records model, input tokens, output tokens and dollars per call in `cost_events` and reports the distribution, not the mean. Its cost rows are tagged so the report can separate them from cron rows, because the sample over-weights long descriptions on purpose.

`first_seen_at` measures the polling schedule, not the market, since a seed run puts a whole board on one day. `posted_at` is the estimate of the real arrival rate. `npm run freshness` prints both.

### D-002. Phase 0 exists to produce one number: measured cost per application

Scoring is the instrument, not a feature to finish.

Break-even across the published plans is USD 0.0117 to 0.0213 per application at full utilisation. The 30 percent cost of goods budget is USD 0.0035 to 0.0064, and the BRD's own USD 0.0045 figure holds. Modelled on gpt-5.6-luna a naive implementation is USD 0.0062 and an optimised one USD 0.0012, so the target is reachable only with the routing and caching the implementation plan assumes.

The biggest lever is match scoring volume, not tailoring. Output tokens were 74 percent of the naive bill in the equivalent Sonnet model, so the scoring prompt is designed for short structured output.

### D-001. gpt-5.6-sol and gpt-5.6-terra are the A/B candidates for MODEL_TAILOR, tested one at a time

Both rates go into `src/server/llm/prices.ts` when tailoring is built, but only one is tested, the next tier above luna. Testing two at once is wasted money. Not now.
