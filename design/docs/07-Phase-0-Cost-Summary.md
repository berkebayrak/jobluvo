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

**The live number is the fresh one.** In a sentence about what Jobluvo does, the held rate is about one in four: 20 of 80 packets on four fresh 20 job samples on 18 September 2026 under rules 1 and 2 with the posting noun in claim position (D-023). The stored packets' figure below describes history, packets the model wrote under an older prompt against an older profile, and it is what the status column states.

| Held rate, 18 September 2026 | Packets |
|---|---|
| Fresh answers, four 20 job samples, final answers | 58 ready, 20 held, 2 invalid, of 80 |
| The same answers read under the rule before the narrowing | 14 ready, 64 held, 2 invalid, of 80 |
| Stored packets, replayed and restamped | 65 ready, 29 held, 7 invalid, of 101 |

The limit, which goes beside this figure every time it is quoted: one user, the current uploaded profile, and every fresh sample fell entirely in the Ashby family, the stratified sample's draw (review three finding 17). The stored figure carries its own: one seeded resume, bullets only, no summary. The true rate on a real population is unknown and could be materially different in either direction. Nobody designs capacity from one in four and nobody assumes it will fall.

This is a product fact, not only a measurement (D-022). At one in four, DOC-03, the packet review screen, is a primary flow, designed and staffed as such, not a fallback screen before submission. A held packet costs nothing today because nothing is submitted, DOC-03 does not exist and the resume is kept for a person; a shipped invention is permanent. That reasoning inverts the day DOC-03 ships.

The tailoring term measured with the retry on the four fresh samples: USD 0.0148, 0.0139, 0.0139 and 0.0153 over 20 packets each, 36, 31, 34 and 37 calls, USD 0.00070 to 0.00077 per packet as each sample's total over its 20, against USD 0.00078 in the function above. The narrowing put the retry inclusive term back under the published figure. Those samples are Ashby only, and the function's tailoring row is restated only from a sample that spans the families the phase 0 sample did, or it says Ashby only and not comparable (D-023).

Superseded figures, each true when written: 4.0 percent on 17 September under the claim validator (D-017), computed by a defective replay; 4.0 percent on 17 September confirmed by the corrected replay (#35); 15.6 percent of the 90 packets ready that day under rule 2 (D-021); 17.8 percent of 101 on 18 September under rule 2 alone; 36.6 percent of 101 stored and seven in ten on fresh answers on 18 September under rule 1 with the posting noun anywhere (D-022).

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
