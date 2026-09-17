# Jobluvo, decision log

Decisions taken during build that the other documents assume but do not state. Newest first. Each entry says what was decided, what it was measured against, and what it forbids.

Companions: [Product BRD](01-Product-BRD.md), [Implementation plan](02-Implementation-Plan.md), [ATS integration plan](04-Job-Parsing-and-ATS-Integration.md)

## 17 September 2026

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
