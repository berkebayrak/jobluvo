# Phase 0, the cost per application

**The upstream model cost per application supports the pricing if scored per applied stays at or below about seven to eight and a half, depending on how many attempted packets become applications. At nine it is over the band's low end in every scenario. Submission, the inbox, the agents and infrastructure are not in this number.**

Phase 0 exists to produce one number (D-002): the measured cost per application, against the USD 0.0035 to 0.0064 budget band, USD 0.0045 target. This page holds the three measured terms, each named for what it is paid per, and the band they make. Each term links to the decision that records how it was measured. All three on gpt-5.6-luna, reasoning off, strict JSON output; scoring and extraction measured 17 September 2026, tailoring restated 18 September under the validator rules that ship (D-024) and restated again the same day as a cost per attempted packet (D-029).

Superseded on 18 September 2026 (D-029): the headline that stood from D-024 to D-029, "at or below about eight, tailoring and extraction together are under USD 0.0009 at any ratio", assumed every attempted packet becomes an application. It did not say so, and about three in ten are held.

## The function

    upstream model cost per application = scored per applied x 0.000311 + 0.0610 / (80 x approval) + 0.0021 / applications per user

| Term | Paid per | USD | How | Decision |
|---|---|---|---|---|
| Scoring | job scored, per user | 0.000311 mean, p10 0.000241, p90 0.000383 | 100 job stratified sample, profile as its own cached message | D-010, D-011 |
| Tailoring | attempted packet, as a change set | 0.00076 per attempted packet including the one retry a held or rejected answer earns, the sample's USD 0.0610 over its 80; 0.00078 under the cited value rule; 0.000538 before any retry | 80 job stratified sample on 18 September 2026, greenhouse 35, ashby 28, lever 13, gem 4, the phase 0 mix; 128 calls, USD 0.0610 in all | D-024, D-013 |
| Extraction | user, once | 0.0021 | one resume as a PDF, five runs; cost representative, accuracy circular | D-014 |

Scoring is a rate: it is paid for every job a user is shown a score for, and an application is one of several. Tailoring is paid per attempted packet, and an attempted packet becomes an application only when it is ready, or held and then approved by a person on DOC-03; the approval rate is unmeasured and cannot be measured without DOC-03 and users. Extraction is paid once per user and spread over however many applications they make. Two unknowns, then: the ratio of jobs scored to applications made, and the share of attempted packets that become applications. Neither can be measured until there are users, so the page gives a band.

| Tailoring per application, by what becomes an application | USD | Break even scored per applied, 25 applications per user | At 10 |
|---|---|---|---|
| Every attempted packet, 80 of 80 | 0.00076 | 8.53 | 8.13 |
| Every packet with a document, ready or held, 78 of 80 | 0.00078 | 8.47 | 8.06 |
| Ready packets only, 54 of 80 | 0.00113 | 7.35 | 6.95 |

These are scenarios from one sample's outcomes, not production estimates: a held packet may be approved later, and an invalid one may go out on the original resume.

## Against the band

Applications per user at 25, the free trial, in the first table; it is a scenario, not the worst case for extraction, so the second table shows 10 and 5. Percentages are computed from the unrounded totals. The three tailoring columns are the three scenarios above.

| Scored per applied, 25 applications per user | Scoring | Extraction | Total, every attempted packet applied | Of the low end | Total, ready only | Of the low end |
|---|---|---|---|---|---|---|
| 5 | 0.0016 | 0.0001 | 0.0024 | 69 percent | 0.0028 | 79 percent |
| 8 | 0.0025 | 0.0001 | 0.0033 | 95 percent | 0.0037 | 106 percent |
| 9 | 0.0028 | 0.0001 | 0.0037 | 104 percent | 0.0040 | 115 percent |
| 10 | 0.0031 | 0.0001 | 0.0040 | 113 percent | 0.0043 | 124 percent |
| 20 | 0.0062 | 0.0001 | 0.0071 | 202 percent | 0.0074 | 212 percent |

| Eight scored per applied | Every attempted packet applied, of the low end | Ready only, of the low end |
|---|---|---|
| 25 applications per user | 95 percent | 106 percent |
| 10 | 99 percent | 109 percent |
| 5 | 105 percent | 115 percent |

At eight scored per applied and 25 applications the number sits inside the band only if every attempted packet becomes an application; on the ready only denominator it is over the low end by 6 percent. At nine it is over the low end in every scenario. At twenty scoring alone is over the low end and the total is over the high end. The break even against the low end runs from 8.53 to 7.35 scored per applied across the scenarios at 25 applications, and from 8.13 to 6.95 at 10. The headroom under the old headline, USD 0.000168 at eight, was smaller than the denominator's effect, which is why one number was the wrong shape for this page.

## Invalid packets

On the 20 job sample under the shipped value rule, 6 of 20 packets needed the one retry and 2 of 20, ten percent, were stored invalid after it. An invalid packet carries no tailored document. The user gets the original resume, built from their confirmed facts as they stand, with a note that the tailored version was withheld and which line failed the check, and DOC-03 lets them choose the original or edit before approval. The packet screen that shows this is not built in phase 0; the rule holds in the data today, an invalid packet has no resume to render, so nothing can submit a line the validator refused.

Both invalid packets were the same sentence on one profile, "managing six", four managers and two analysts added together, written again after the retry. The rate is one stubborn pattern, not a general failure, and it needs re-measuring on a real uploaded resume before it means anything.

## Held packets, the current rate

This is the one place the held rate is stated. Every earlier figure in the decision log points here and says superseded. When the rate changes, this section changes and the entry that changed it says so.

**The live number is the fresh cross family one.** In a sentence about what Jobluvo does, the held rate is about three in ten: 24 of 80 packets on the 80 job stratified sample of 18 September 2026, greenhouse 35, ashby 28, lever 13, gem 4, under rules 1 and 2 with the posting noun in claim position and the summary openers (D-023, D-024). The stored packets' figure describes history and is what the status column states.

| Held rate, 18 September 2026 | Packets |
|---|---|
| Fresh answers, 80 job cross family sample, the retained attempt as stored by the run, and re-read under the rules as they stand (D-029) | 54 ready, 24 held, 2 invalid, of 80 |
| The same answers, last attempt only, what the scope table counted; the three that differ are held first answers kept over a rejected retry (D-029) | 54 ready, 21 held, 5 invalid, of 80 |
| The same answers read under the rule before the narrowing | 21 ready, 54 held, 5 invalid, of 80 |
| Stored packets of 17 September, replayed and restamped at 22:50 UTC on 18 September, one seeded resume | 65 ready, 29 held, 7 invalid, of 101. Superseded the same day (D-029): at 22:57 UTC the families-18sep run stored its packets and replaced 74 of these rows. A dated observation, not a description of the table |
| The table on 18 September after that write, two profiles | 68 ready, 35 held, 4 invalid, of 107. Not a rate: 80 packets on the uploaded profile and 27 on the seeded one, never combined |

The limit, which goes beside this figure every time it is quoted: one user, the current uploaded profile, one draw of 80 jobs in four families. The stored figure carries its own: one seeded resume, bullets only, no summary. The true rate on a real population is unknown and could be materially different in either direction. Nobody designs capacity from three in ten and nobody assumes it will fall.

The held rate is a workflow outcome, not a validator accuracy measure (D-029). It counts how often the validator fired. Nothing here counts how often it should have fired and did not, so a lower rate could mean fewer false positives or more missed inventions, and today there is no way to tell which. The measurement that would tell, an evaluation set with deliberately unsupported examples and a miss rate, does not exist yet. And of the 48 retries in the 80 job sample, 2 substituted words as the prompt asks, 2 reverted to the base resume and 37 dropped edited lines (D-029, `design/snapshots/2026-09-18-packets/reconciliation.md`): a ready packet after a retry is not evidence that the held claim was corrected.

This is a product fact, not only a measurement (D-022). At three in ten, DOC-03, the packet review screen, is a primary flow, designed and staffed as such, not a fallback screen before submission. A held packet costs nothing today because nothing is submitted, DOC-03 does not exist and the resume is kept for a person; a shipped invention is permanent. That reasoning inverts the day DOC-03 ships.

Superseded figures, each true when written: 4.0 percent on 17 September under the claim validator (D-017), computed by a defective replay; 4.0 percent on 17 September confirmed by the corrected replay (#35); 15.6 percent of the 90 packets ready that day under rule 2 (D-021); 17.8 percent of 101 on 18 September under rule 2 alone; 36.6 percent of 101 stored and seven in ten on fresh answers on 18 September under rule 1 with the posting noun anywhere (D-022); one in four on fresh answers on 18 September under the narrowing (D-023). The seven in ten and one in four were six generations over the same 20 Ashby jobs, the fixed seed and the old draw, not 120 jobs (D-024).

## What the extraction accuracy is not

The resume the extractor was measured on was rendered from Jack's seeded facts: one column, plain headings, no tables. Reading 4 of 4 roles and 18 of 18 bullets back word for word tests the pipeline, not extraction, and must not be quoted as an extraction benchmark. The cost, USD 0.0021 per resume, is real and representative of a resume of that length. The accuracy is not; a real resume has two columns, tables, date ranges and inconsistent headings, and that measurement waits for real uploads.

## What follows

- The ratio is the business case. It is controlled, not measured: the hard filter is free and removes about sixty percent of the inventory before any claim, and nothing is scored that a user will not see (D-012). A cheap pre rank ahead of the model call is on the critical path, not a later optimisation.
- The cache order is a lever (D-012): put first whichever message the batch repeats. Today the profile, one user against many jobs; at scale possibly the job, one posting for many users.
- Output tokens are the tailoring and extraction bill; input tokens are the scoring bill after caching. The change set (D-013) halved tailoring's output; the same idea does not apply to extraction, whose output is the product.
- The validator is the product's guarantee, not a cost device (D-013). A value must appear in a fact the line cites; measured over 520 edits before it shipped, 5 rejected, all one invention, 0 legitimate edits failing. Its price is the retry, which is what moved tailoring from USD 0.00054 to 0.00078.

## What the measurement cost

614 model calls in `cost_events` on 17 September 2026: scoring USD 0.20, tailoring 0.15, extraction 0.02, about USD 0.38 in all. `npm run cost-report` prints the distributions from the same rows.

## What is not in the number

Submission, the inbox, the agents, infrastructure and any model call after the packet: this page states the upstream model cost, and at the headroom above that distinction is not pedantry. The held packet approval rate and the ratio of jobs scored to applications made, both of which need users. Volume assumptions from the plans are not applied here; the band is the 30 percent cost of goods budget at the published prices (D-002).
