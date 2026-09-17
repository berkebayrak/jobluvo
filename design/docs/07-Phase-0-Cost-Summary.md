# Phase 0, the cost per application

**The cost per application supports the pricing if scored per applied stays at or below about eight. At nine the total is over the band's low end by 5 percent, at ten by 14 percent. Nothing else in the function moves the answer: tailoring and extraction together are under USD 0.0009 at any ratio.**

Phase 0 exists to produce one number (D-002): the measured cost per application, against the USD 0.0035 to 0.0064 budget band, USD 0.0045 target. This page holds the three measured terms and the function they make. Each term links to the decision that records how it was measured. All three on gpt-5.6-luna, reasoning off, strict JSON output, 17 September 2026.

## The function

    cost per application = scored per applied x 0.000311 + 0.00078 + 0.0021 / applications per user

| Term | Paid per | USD | How | Decision |
|---|---|---|---|---|
| Scoring | job scored, per user | 0.000311 mean, p10 0.000241, p90 0.000383 | 100 job stratified sample, profile as its own cached message | D-010, D-011 |
| Tailoring | application, as a change set | 0.00078 per packet including the retries the cited value rule adds; 0.000538 before it | 20 job sample under the shipped rule; 100 job sample before it | D-013 |
| Extraction | user, once | 0.0021 | one resume as a PDF, five runs; cost representative, accuracy circular | D-014 |

Scoring is a rate: it is paid for every job a user is shown a score for, and an application is one of several. Tailoring and extraction are fixed. The unknown is the ratio of jobs scored to applications made, which cannot be measured until there are users.

## Against the band

Applications per user set to 25, the free trial, so extraction is at its heaviest; at 100 it falls below USD 0.0001. Tailoring is the shipped term, USD 0.00078 per packet with the retries the cited value rule adds. Percentages are computed from the unrounded totals.

| Scored per applied | Scoring | Tailoring | Extraction | Total, USD | Of the low end | Of the high end |
|---|---|---|---|---|---|---|
| 5 | 0.0016 | 0.0008 | 0.0001 | 0.0024 | 69 percent | 38 percent |
| 8 | 0.0025 | 0.0008 | 0.0001 | 0.0034 | 96 percent | 52 percent |
| 9 | 0.0028 | 0.0008 | 0.0001 | 0.0037 | 105 percent | 57 percent |
| 10 | 0.0031 | 0.0008 | 0.0001 | 0.0040 | 114 percent | 62 percent |
| 20 | 0.0062 | 0.0008 | 0.0001 | 0.0071 | 202 percent | 111 percent |

At eight scored per applied the number sits inside the band. At nine it is over the low end by 5 percent, at ten by 14 percent. At twenty scoring alone is over the low end and the total is over the high end. Tailoring and extraction together are USD 0.00086 at any ratio.

## Invalid packets

On the 20 job sample under the shipped value rule, 6 of 20 packets needed the one retry and 2 of 20, ten percent, were stored invalid after it. An invalid packet carries no tailored document. The user gets the original resume, built from their confirmed facts as they stand, with a note that the tailored version was withheld and which line failed the check, and DOC-03 lets them choose the original or edit before approval. The packet screen that shows this is not built in phase 0; the rule holds in the data today, an invalid packet has no resume to render, so nothing can submit a line the validator refused.

Both invalid packets were the same sentence on one profile, "managing six", four managers and two analysts added together, written again after the retry. The rate is one stubborn pattern, not a general failure, and it needs re-measuring on a real uploaded resume before it means anything.

## Held packets, the current rate

This is the one place the held rate is stated. Every earlier figure in the decision log points here and says superseded. When the rate changes, this section changes and the entry that changed it says so.

| Held rate, 18 September 2026, under rule 2 (D-021) | Packets |
|---|---|
| Packets with a candidate | 101 |
| Held for review | 18, 17.8 percent |
| Of those, by rule 2, a value bound to words its fact never gave | 14 |
| Of those, by the claim validator before it, D-017 | 4 |
| Ready | 76 |
| Invalid | 7 |

The limit, which goes beside this figure every time it is quoted: one seeded resume, one user, one vocabulary, bullets only, no summary. It is provisional until rule 1, the redesign of the non numeric check (review three finding 3), lands, and it will be restated once more then. Rule 1 may move some of the 14 back to ready as well as hold more, so the number can go down as well as up; 17.8 percent is not a floor. A held packet costs nothing today: nothing consumes packets, submission is gated behind DOC-03 (D-017), and a held packet keeps its resume for that screen.

Superseded figures, each true when written: 4.0 percent on 17 September under the claim validator (D-017), computed by a defective replay; 4.0 percent on 17 September confirmed by the corrected replay (#35, the correction under D-017); 15.6 percent of the 90 packets ready that day under rule 2 (D-021), the same measurement as the table above with the earlier held packets left out of the denominator.

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

Submission, the inbox, the agents and any model call after the packet. Volume assumptions from the plans are not applied here; the band is the 30 percent cost of goods budget at the published prices (D-002).
