# Phase 0, the cost per application

Phase 0 exists to produce one number (D-002): the measured cost per application, against the USD 0.0035 to 0.0064 budget band, USD 0.0045 target. This page holds the three measured terms and the function they make. Each term links to the decision that records how it was measured. All three on gpt-5.6-luna, reasoning off, strict JSON output, 17 September 2026.

## The function

    cost per application = scored per applied x 0.000311 + 0.000538 + 0.0022 / applications per user

| Term | Paid per | USD | How | Decision |
|---|---|---|---|---|
| Scoring | job scored, per user | 0.000311 mean, p10 0.000241, p90 0.000383 | 100 job stratified sample, profile as its own cached message | D-010, D-011 |
| Tailoring | application, as a change set | 0.000538 per packet, p50 0.000570 | same 100 jobs, edits only, validated | D-013 |
| Extraction | user, once | 0.0022 | one resume as a PDF, five runs | D-014 |

Scoring is a rate: it is paid for every job a user is shown a score for, and an application is one of several. Tailoring and extraction are fixed. The unknown is the ratio of jobs scored to applications made, which cannot be measured until there are users.

## Against the band

Applications per user set to 25, the free trial, so extraction is at its heaviest; at 100 it falls below USD 0.0001.

| Scored per applied | Scoring | Tailoring | Extraction | Total, USD | Of the low end | Of the high end |
|---|---|---|---|---|---|---|
| 5 | 0.0016 | 0.0005 | 0.0001 | 0.0022 | 62 percent | 34 percent |
| 8 | 0.0025 | 0.0005 | 0.0001 | 0.0031 | 89 percent | 49 percent |
| 10 | 0.0031 | 0.0005 | 0.0001 | 0.0037 | 107 percent | 59 percent |
| 20 | 0.0062 | 0.0005 | 0.0001 | 0.0069 | 196 percent | 107 percent |

At eight scored per applied the number sits inside the band. At ten it is over the low end. At twenty scoring alone is over the low end and the total is over the high end. Tailoring and extraction together are under USD 0.0007 at any ratio.

## What follows

- The ratio is the business case. It is controlled, not measured: the hard filter is free and removes about sixty percent of the inventory before any claim, and nothing is scored that a user will not see (D-012). A cheap pre rank ahead of the model call is on the critical path, not a later optimisation.
- The cache order is a lever (D-012): put first whichever message the batch repeats. Today the profile, one user against many jobs; at scale possibly the job, one posting for many users.
- Output tokens are the tailoring and extraction bill; input tokens are the scoring bill after caching. The change set (D-013) halved tailoring's output; the same idea does not apply to extraction, whose output is the product.
- The validator is the product's guarantee, not a cost device (D-013). Its wrong citation rate is tracked per sample: 0.96 per 100 cited edits on the first.

## What the measurement cost

614 model calls in `cost_events` on 17 September 2026: scoring USD 0.20, tailoring 0.15, extraction 0.02, about USD 0.38 in all. `npm run cost-report` prints the distributions from the same rows.

## What is not in the number

Submission, the inbox, the agents and any model call after the packet. Volume assumptions from the plans are not applied here; the band is the 30 percent cost of goods budget at the published prices (D-002).
