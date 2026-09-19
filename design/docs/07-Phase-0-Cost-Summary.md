# Phase 0, the cost per application

**The upstream model cost per application supports the pricing if scored per applied stays at or below about seven to eight and a half, depending on how many attempted packets become applications. At nine it is over the band's low end in every scenario. Submission, the inbox, the agents and infrastructure are not in this number, and the tailoring term is a historical measurement taken under a prompt and a validator that have since been replaced.**

Phase 0 exists to produce one number (D-002): the measured cost per application, against the USD 0.0035 to 0.0064 budget band, USD 0.0045 target. This page holds the three measured terms, each named for what it is paid per, and the band they make. Each term links to the decision that records how it was measured. All three on gpt-5.6-luna, reasoning off, strict JSON output; scoring and extraction measured 17 September 2026, tailoring restated 18 September under the validator rules that ship (D-024) and restated again the same day as a cost per attempted packet (D-029).

Superseded on 18 September 2026 (D-029): the headline that stood from D-024 to D-029, "at or below about eight, tailoring and extraction together are under USD 0.0009 at any ratio", assumed every attempted packet becomes an application. It did not say so, and about three in ten are held.

**Every term on this page is a historical measurement, and the tailoring term was measured under a policy that no longer ships (review five, 18C).** Since USD 0.0610 over 80 was measured on 18 September, the retry has been given the previous answer to correct rather than the findings alone (prompt revision 2026-09-18.p2, #64), a retry's clean dropped lines are put back and the merged set revalidated (#64), and the validator has moved three revisions. Every one of those changes what the model is sent, what it sends back, or how many lines a second attempt has to write. Replaying stored answers offline cannot measure any of it: it re-reads answers the old prompt produced and cannot say what the new prompt would produce, how often a retry would be earned, or what either would cost in tokens. **The cost per attempted packet under the policy that ships today is unmeasured.** It becomes measured when an authorised paid run measures it, and not before. The figure below is kept because it is the last one that was measured, labelled with the revisions it was measured under.

## Current state, 19 September 2026

**Everything below this section is dated and is superseded unless this section repeats it.**
Each superseded figure keeps its date and the population it was measured on. Several of them
are true of different populations and were being read as though they described one, which is
what the sixth review found.

### The stored packets

| Status | Packets | Validator revision | Document on the row |
|---|---|---|---|
| ready | 83 | 2026-09-19.r11 | 83 |
| needs_review | 22 | 2026-09-19.r11 | 22 |
| invalid | 2 | 2026-09-18.r6 | 0 |

Two restamps produced this, both applied 19 September 2026 from merged code. The r9 restamp
(D-040) wrote 101 rows and **changed no status**, which is what it was expected to do. The
repair (D-043) then wrote 105 rows and changed four: the four rejected rows whose document
exists in `design/snapshots/2026-09-18-packets` had it restored, verified against their own
stored changes, revalidated, and stamped **needs_review** on what the validator said. None was
promoted to ready.

**What the repair establishes, stated narrowly after the seventh review (D-048).** The guard
proves the offered document is **consistent with the row's own stored changes**. It does not
prove the bytes are that row's historical artifact: any document those changes could produce
would pass the same test.

**The record of where those documents came from is already gone, and was gone before anyone
noticed.** This is not a fragile record that might fail later. The `resume-repaired` finding was
written onto the four rows on 19 September and the r10 restamp of the same day dropped it from
all four, because a replay retains only a row's summary findings. It was found by querying the
rows two hours later, not by reading the code that would have predicted it. So **the four rows
carry documents taken from a snapshot and nothing on them says so**; their provenance is in
D-043, D-048 and this page, and nowhere in the database. An earlier version of this paragraph
said each row carries the finding, which was false when it was written.

**Every row in the table now has a document except the two that never had one.** That is the
first time that has been true since 18 September.

**These 107 rows are two profiles and are not one comparable population.** 80 are on
`c9f231127f13`, the uploaded resume confirmed now; 27 are on `c70bf9c31851`, the seeded facts
retired when that upload was confirmed. They were tailored under different prompts, different
validator revisions and different fact sets. A rate taken over all 107 divides outcomes of one
population by the size of two, and no rate on this page is computed that way.

**None of the 22 held is the validator objecting to a claim it read on a value.** 11 are rows
whose summary cannot be revalidated because they were stored before change sets were kept, 6
are rows rebuilt into a hold by D-037, 4 are the rows repaired by D-043, held by the posting
word or name finding that had rejected them plus, on two of them, a summary nothing could
revalidate, and 1 is a row whose posting text has moved since it was written.

**The 2 invalid have no document anywhere.** Not on the row, not in the snapshot, and no change
set to rebuild one from. They are the honest remainder of the thirteen: everything that could be
reconstructed or restored has been, and these two cannot be. Neither is invalid for a fabricated
value; both carry `value-not-in-cited` on `num:6`, from a rule D-034 deleted.

### What the check catches

| Evaluation set | Flagged | Rejected | Held | Passes |
|---|---|---|---|---|
| 32 false lines, written by the rules' author | 8 | 4 | 4 | 24 |
| 14 false lines, written by a second author | 0 | 0 | 0 | 14 |
| 18 lines labelled supported, which must pass | 0 | 0 | 0 | 18 |
| 4 lines pending adjudication, asserted about nowhere | 0 | 0 | 0 | 4 today |

**Eight of forty six are flagged, four of them rejected.** Earlier wording said "four of forty
two", which counted only the rejections and understated what the check does; and a held packet
is not a caught fabrication either, because nobody has yet decided any of them. Both halves of
that sentence matter and neither is the number to quote alone.

The set moved from 28 false and 26 truthful to **32 and 22** on 19 September 2026, in two rounds.
D-044 moved two lines that were counted as truthful controls and are case 3, taking case 3 from 1
of the rules author's lines to 3. D-047 audited what was left against a stated standard, every
element of a control supported by the facts it cites, and moved two more that add an element no
fact carries: a beneficiary for the dashboards and a second deliverable beside them. **None of
the four is caught**, so the flagged count has not moved and only the denominator has. Four of the
22 controls that remain are marked for adjudication in the file's header rather than guessed at.

`src/server/packet/pairs.test.ts` **no longer asserts that 28 of 28 are caught**, and has not
since 18 September 2026 (D-034). It asserts three things: every truthful line passes, the
lines the invention check does reject are still rejected by name, and the counts print by
author and by case and are never summed. Its header says in as many words that it is not
evidence that Jobluvo catches fabrication.

### Is there a held rate

Yes. It is 18 of 101 rows with a candidate, 17.8 percent, on two profiles counted separately.
The sentence below that says there is no held rate any more was true for one day under D-034,
when every remaining finding was hard, and D-036 demoted three of them back to review the next
day. It is marked where it stands.

The held rate counts how often the validator fired. It does not count how often it should have
fired and did not, so it is not a quality measure in either direction.

### What the code does, in one paragraph

It checks that every value and every name in a tailored line appears somewhere in the user's
confirmed facts. A value that matches nothing rejects the packet, but only while every number
on the profile could be read (D-040); otherwise it holds. Every name and posting word check
holds (D-036). A rejection no longer deletes the document it rejected; the status is what
stops it being served (D-038). Nothing reads what a line means. **This is a placeholder and
not the design**, and the permanent answer is the checking model call recorded in D-036 and
not built.

## The function

    upstream model cost per application = scored per applied x 0.000311
                                         + 0.0610 / (80 x conversion)
                                         + 0.0021 x extractions per user / applications per user

| Term | Paid per | USD | How | Decision |
|---|---|---|---|---|
| Scoring | job scored, per user | 0.000311 mean, p10 0.000241, p90 0.000383 | 100 job stratified sample, profile as its own cached message | D-010, D-011 |
| Tailoring | attempted packet, as a change set | 0.00076 per attempted packet including the one retry a held or rejected answer earns, the sample's USD 0.0610 over its 80; 0.00078 under the cited value rule; 0.000538 before any retry. **Historical: measured under prompt revision p1 and validator revision 2026-09-18.r3, both superseded. Unmeasured under the policy that ships today** | 80 job stratified sample on 18 September 2026, greenhouse 35, ashby 28, lever 13, gem 4, the phase 0 mix; 128 calls, USD 0.0610 in all | D-024, D-013 |
| Extraction | extraction, of which a user may make more than one | 0.0021 | one resume as a PDF, five runs; cost representative, accuracy circular | D-014 |

Scoring is a rate: it is paid for every job a user is shown a score for, and an application is one of several.

**Conversion is packet to application, not approval among held packets (review five, 18E; denominator restated by D-034).** With nothing held, "approval among held packets" no longer names a population at all: the quantity is approval among all attempted packets, since every packet goes to DOC-03 and almost none carries a finding. That does not change the term below, which was already denominated in attempted packets; it removes the thing it was being confused with.

**Conversion is packet to application, not approval among held packets (review five, 18E).** The denominator of the tailoring term is attempted packets, so the quantity that converts it is the share of all attempted packets that become applications. That is not the same as the approval rate on DOC-03, and the two must not be swapped: a ready packet can still fail to be submitted, an invalid one can go out on the original resume, and a held one can be approved. Conversion is one number covering all three routes, it is unmeasured, and it cannot be measured without DOC-03 and users.

Extraction is paid per extraction, not per user (review five, 18D). The product lets a user upload a replacement resume whenever they want one, so extractions per user is at least one and has no ceiling the product enforces. The old wording, "per user, once", was an assumption dressed as a unit. The tables below hold extractions per user at 1, which is the floor; a user who re-uploads once doubles that term.

Three unknowns, then: the ratio of jobs scored to applications made, the share of attempted packets that become applications, and how many times a user has a resume read. None can be measured until there are users, so the page gives a band.

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

**Corrected on 18 September 2026 (review five, 18A).** This paragraph said the number sits inside the band at eight scored per applied "only if every attempted packet becomes an application". That is false, and it is false against this page's own table: the 78 of 80 scenario gives USD 0.00335, inside the band, with two packets not converting. The claim confused "the only scenario in the table that is inside" with "the only conversion that is inside", and it never solved for the threshold.

Solved: at eight scored per applied, the conversion at which the total reaches the low end is

| Extractions and applications per user | Conversion needed to stay inside the band, of 80 attempted packets | As a share |
|---|---|---|
| 1 extraction, 25 applications | 65.7 | about 82 percent |
| 1 extraction, 10 applications | 76.1 | about 95 percent |
| 1 extraction, 5 applications | 103.0 | over 80, so no conversion is enough |

So at eight scored per applied and 25 applications, roughly four in five attempted packets converting is sufficient, not five in five. At 10 applications almost every packet must convert. At 5 the extraction term alone puts eight over the low end whatever converts. At nine scored per applied it is over the low end in every scenario in the table, and at twenty scoring alone is over the low end and the total is over the high end. The break even against the low end runs from 8.53 to 7.35 scored per applied across the scenarios at 25 applications, and from 8.13 to 6.95 at 10.

What this does not say: that the product economics work. It says the upstream model cost fits the allowance under stated assumptions. Submission, the inbox, the agents and infrastructure are not in this number, and conversion, scored per applied and extractions per user are all unmeasured.

## Invalid packets

On the 20 job sample under the shipped value rule, 6 of 20 packets needed the one retry and 2 of 20, ten percent, were stored invalid after it. An invalid packet carries no tailored document. The user gets the original resume, built from their confirmed facts as they stand, with a note that the tailored version was withheld and which line failed the check, and DOC-03 lets them choose the original or edit before approval. The packet screen that shows this is not built in phase 0; the rule holds in the data today, an invalid packet has no resume to render, so nothing can submit a line the validator refused.

Both invalid packets were the same sentence on one profile, "managing six", four managers and two analysts added together, written again after the retry. The rate is one stubborn pattern, not a general failure, and it needs re-measuring on a real uploaded resume before it means anything.

## Held packets, the current rate

This is the one place the held rate is stated. Every earlier figure in the decision log points here and says superseded. When the rate changes, this section changes and the entry that changed it says so.

**A note on dates, because one of them was wrong (review five, 17).** A run tag is named for the date in Istanbul and every timestamp on this page is UTC, and Istanbul is three hours ahead. So the runs tagged `18sep` have UTC timestamps on 17 September: `families-18sep-changes` wrote its 128 cost rows between 22:57:07 and 22:58:20 UTC on 17 September, which is 01:57 on 18 September in Istanbul. This row previously dated the restamp that preceded that write to 22:50 UTC on 18 September, which cannot be seven minutes before 22:57 UTC on 17 September. The snapshot settles it: the 27 surviving rows of that restamp carry `updated_at` of 22:49 and 22:50 UTC on 17 September. The restamp was 17 September and the date here is corrected.

**Superseded on 19 September 2026 after one day, and kept because it is quoted. Population: the 80 saved answers of the 18 September cross family sample, under D-034's levels.** It read: "There is no held rate any more. D-034 removed the meaning comparison, and the number this section exists to state is now a rejection rate of 7.5 percent with nothing held. Re-reading the same 80 saved answers under the code as it stands: 74 ready, 0 held, 6 invalid."

That was true only while every remaining finding was hard. D-036 demoted the name, posting word and qualification findings to review the next day, so the same 80 answers now read **74 ready, 6 held, 0 invalid**: the same six answers, the same two findings, a hold instead of a rejection. The two findings are a word taken from the posting that no fact carries (5) and a name that no fact carries (2). There is a held rate; the current state section at the top of this page states it.

Read that 7.5 percent for what it is. It is not a quality measure and it is not an improvement on 33.8 percent. The same answers are being read by a check that asks far less. Against the 32 known false lines of `pairs.test.ts` the code rejects 4 and holds 4, where it flagged all 28 of the 28 it then held before; of a second author's 14 it flags none. **Eight of forty six are flagged, four of them rejected** (corrected 19 September 2026: this said "four of forty two", which counted the rejections only, over a set that was itself four lines short). A held line is not a caught fabrication either, because nobody has decided any of them yet. What the packets say about themselves changed; the packets did not.

**The check is a placeholder, not the design (D-036).** The permanent answer is a separate model call that reads the confirmed facts and the tailored lines and judges whether each claim is supported, and it is not built because it does not fit the budget: about USD 0.0004 to 0.0008 per application against roughly USD 0.00017 of room at eight jobs scored per application.

**Corrected 19 September 2026. This said "the pre rank comes first and pays for the checking call" as though it were settled. It is conditional, and the condition is two numbers that do not exist.** At 25 applications per user and one extraction, the arithmetic is:

| Scored per applied | Base | Room to the low end | With a 0.0004 checker | With a 0.0008 checker |
|---|---|---|---|---|
| 8 | 0.003332 | 0.000168 | 0.003732, 107 percent | 0.004132, 118 percent |
| 7 | 0.003021 | 0.000479 | 0.003421, **98 percent** | 0.003821, 109 percent |
| 6 | 0.002710 | 0.000790 | 0.003110, 89 percent | 0.003510, 100 percent |

So a pre rank that reaches seven pays for a checker at the cheap end of the range and does not
pay for one at the expensive end. The break even is 7.25 scored per applied for a 0.0004
checker and 5.97 for a 0.0008 one. **Whether the pre rank pays for the checking call depends
on the measured pre rank saving and the measured checker cost, and neither has been
measured.** The sequencing still holds, because the pre rank is the only lever on the term
that dominates; the conclusion that it is sufficient does not.

**And the pre rank has to be measured for the right thing.** Scored per applied is a ratio,
and a pre rank that cuts the numerator by dropping jobs the user would have applied to cuts
the denominator with it. Such a pre rank improves the ratio on paper and reduces applications,
which is the product. Any pre rank measurement states what it did to applications, not only
what it did to scores.

Until then the code rejects a fabricated figure, holds a suspicious word, and holds a figure
it could not have matched (D-040); the tailoring prompt, including the self check the model
runs on its own lines in the same call, is what stands in for the rest.

**The self check added to the prompt costs about USD 0.0000424 per packet on the input side. That is an estimate under stated assumptions, not a measurement, and it was labelled as measured until 19 September 2026.** What each part of it is:

| Quantity | What it is |
|---|---|
| 423 characters | **measured**, the sentence itself |
| about 106 tokens | **an estimate**, four characters to a token, no tokeniser was run |
| two calls per packet | **an assumption**, and the ceiling rather than the average: it holds only when every packet earns its retry, and most do not |
| USD 0.2 per million input tokens | the published input price |
| the output side | **unmeasured** |

So USD 0.0000424 is an upper bound on the input side under an estimated token count, and the
figure on a packet that makes one call is half of it. The percentages that follow from it, 5.6
percent of the tailoring term and 1.3 percent of the per application figure, carry the same
labels. The output side should not grow, because the schema is closed and the instruction says
not to write commentary, but that is an expectation and no paid run has tested it. Both sides
get measured with the first paid run of phase 1.

The retry prompt of D-039 is on the same footing: 622 characters added, **measured**; about
156 tokens, **an estimate**; paid on the retry call only, never on a first call.

**The figure this section used to state, kept because it is what the stored rows carry until the restamp.** The held rate was about three in ten: 24 of 80 packets on the 80 job stratified sample of 18 September 2026, greenhouse 35, ashby 28, lever 13, gem 4, under rules 1 and 2 with the posting noun in claim position and the summary openers (D-023, D-024).

**The seven rebuilt, applied 19 September 2026 from merged code (D-037).** Before: 82 ready, 12 held, 13 invalid. After: **83 ready, 18 held, 6 invalid.** Seven rows whose resumes a withdrawn rule cleared were rebuilt from their own stored change sets and read again by the validator as it stands: one came back ready, six came back held by the same findings that had rejected them, now review rather than hard. The six with no stored change set cannot be reconstructed and stay invalid; none of them is invalid for a fabricated value either, only for the absence of a document. **Superseded the same day by D-043**: four of those six have their document in the frozen snapshot and were repaired, so the six became two. The sentence was right that nothing could reconstruct them from the row and wrong to read that as no document existing.

The held count of 18 is now 12 rows with an unrevalidatable summary plus the 6 just rebuilt into a hold. As before, none of it is the validator objecting to a claim it read.

**The r8 restamp, applied 19 September 2026 from merged code (D-036), and what it could not undo.**

Before, r7: 82 ready, 12 held, 13 invalid. After, r8: 82 ready, 12 held, 13 invalid. **No stored row moved.** 94 rows were rewritten at `2026-09-18.r8` with 0 status changes; the 13 invalid ones could not be restamped at all.

That last part is the finding, and it is not a good one. Under r8 every one of those 13 rows passes: 10 would be held and 3 ready. None of them can be promoted, because a packet that goes invalid loses its stored resume, and r7 cleared theirs yesterday. The demotion arrived a day after the rejection that destroyed the work.

**Not one of the 13 is invalid for a fabricated value.** The user asked for the fabricated value on every still invalid packet to be named. There are none to name:

| Revision | Rows | The finding that rejected them | Is it a fabrication |
|---|---|---|---|
| r6 | 3 | `value-not-in-cited`, `num:6` | No. That is the cited fact rule D-034 deleted. "6" is on the profile, so under the rule as it stands the value is supported |
| r7 | 3 | `name-unknown`, `KPI` | No. A word read as a name by its form, which D-036 demoted to a hold |
| r7 | 7 | `posting-word-unknown`: alignment, analytics, cross-team, execution, experience, members, professionals, relationships, roadmap | No. Ordinary English nouns the posting also uses, which D-036 demoted to a hold |

Nine of those words are "alignment", "analytics", "cross-team", "execution", "experience", "members", "professionals", "relationships" and "roadmap". None is an invented metric, employer, product or qualification. They are the false positive class D-036 exists to stop, caught in the one day the level was hard.

**Seven of the 13 carry a stored change set**, so their resume is rebuildable from the base plus that change set, deterministically. Six do not. Rebuilding them is a separate decision and is not taken here; the report refuses to promote a row whose resume it cannot see, which is the rule from review five finding 6 doing its job.

**The stored packets were restamped under r7 on 18 September 2026, from merged code (D-034).** Before: 61 ready, 42 held, 4 invalid, of 107, all at r6, and the r6 replay reproduced that table exactly. After: 82 ready, 12 held, 13 invalid. 104 rows were written at `2026-09-18.r7`; 3 stayed at r6 because they are invalid with no resume to promote and there is nothing to restamp.

The rows that moved, named:

| From | Packets | To | Why |
|---|---|---|---|
| ready | 61 | 61 ready | None moved. Removing rules cannot hold a row that already passed |
| needs_review | 21 | ready | Held only by a rule that compared the line with its cited fact. That comparison is gone |
| needs_review | 12 | needs_review | Still held, and all of it is the summary that cannot be revalidated on a row stored before change sets were kept. Not a validator finding about the text |
| needs_review | 9 | invalid | A name or a posting word in no confirmed fact. The finding did not change; its level did, from review to hard (D-034) |
| invalid | 1 | invalid | Restamped, still rejected |
| invalid | 3 | unchanged, r6 | Invalid with no resume to promote; nothing to restamp |

Nine rows went from held to rejected and their stored resumes were cleared, which is why the stored resume count falls from 103 to 94. The twelve that remain held are held by a gap in the record, not by anything the validator read in a line, so the held rate of record under r7 is better read as zero.

| Held rate, 18 September 2026 | Packets |
|---|---|
| Stored packets after the D-043 repair, 19 September 2026, current | **83 ready, 22 held, 2 invalid**, of 107, all at r9. Four rows whose document exists in the frozen snapshot had it restored, verified against their own stored changes and revalidated: all four came back held, none ready. The 2 left have no document anywhere |
| Stored packets after the r9 restamp, 19 September 2026 | 83 ready, 18 held, 6 invalid, of 107. 101 rows written, no row moved. Superseded by the repair the same day |
| Stored packets after the D-037 rebuild, 19 September 2026 | 83 ready, 18 held, 6 invalid, of 107. Seven rebuilt from their stored change sets: 1 ready, 6 held. The 6 left have no change set to rebuild from | Superseded by the repair the same day |
| Stored packets restamped under r8 from merged code (D-036) | 82 ready, 12 held, 13 invalid, of 107. No row moved; the 13 all passed under r8 and none could be promoted, because r7 cleared their resumes. Superseded by the rebuild |
| Stored packets restamped under r7 from merged code (D-034) | 82 ready, 12 held, 13 invalid, of 107. The 12 are all the unrevalidatable summary. Superseded by r8 the next day |
| Fresh answers, 80 job cross family sample, the retained attempt as stored by the run, and re-read under the rules as they stand (D-029) | 54 ready, 24 held, 2 invalid, of 80 |
| The same answers, last attempt only, what the scope table counted; the three that differ are held first answers kept over a rejected retry (D-029) | 54 ready, 21 held, 5 invalid, of 80 |
| The same answers read under the rule before the narrowing | 21 ready, 54 held, 5 invalid, of 80 |
| Stored packets of 17 September, replayed and restamped at 22:50 UTC on 17 September, one seeded resume | 65 ready, 29 held, 7 invalid, of 101. Superseded the same day (D-029): at 22:57 UTC the families-18sep run stored its packets and replaced 74 of these rows. A dated observation, not a description of the table |
| The table on 18 September after that write, before the restamp, two profiles | 68 ready, 35 held, 4 invalid, of 107. Superseded by the restamp of that afternoon, the line below |
| The table on 18 September after the restamps of that afternoon (D-030, D-031), two profiles | 62 ready, 41 held, 4 invalid, of 107, every row carrying the validator revision it passed under, now 2026-09-18.r5. The second restamp added stable codes to the stored findings and moved no status. Not a rate: 80 packets on the uploaded profile and 27 on the seeded one, never combined. 6 of the 68 ready moved, 5 of them legacy rows whose summary cannot be revalidated and 1 on the entity rule |

The limit, which goes beside this figure every time it is quoted: one user, the current uploaded profile, one draw of 80 jobs in four families. The stored figure carries its own: one seeded resume, bullets only, no summary. The true rate on a real population is unknown and could be materially different in either direction. Nobody designs capacity from three in ten and nobody assumes it will fall.

The held rate is a workflow outcome, not a validator accuracy measure (D-029). It counts how often the validator fired. It does not count how often it should have fired and did not, so a lower held rate on its own could mean fewer false positives or more missed inventions.

**What a retry does to an unsupported line, counted rather than inferred from a rate (review five, 18B).** On the 80 saved answers, of the 39 lines the first attempt left unsupported by what they cite:

| What became of it | Lines | Share |
|---|---|---|
| Corrected, the line is still there and is now supported | 19 | 48.7 percent |
| Deleted, the line is gone and its problem with it | 16 | 41.0 percent |
| Retained, the same unsupported claim | 3 | 7.7 percent |
| Replaced by a different unsupported claim | 1 | 2.6 percent |

**The retry corrects about half of what it is sent back for and deletes about two fifths of it.** That is the sentence this table exists to support, and it replaces the withdrawn one.

One further line is unsupported on the retained attempt that was not on the first, so the retained total of 5 is 3 retained plus 1 replaced plus 1 new. The deletion is what the merge rule of finding 14 stops.

An earlier entry, D-031, read the same two rates as "39 percent of that fall is the denominator". That was arithmetically backwards and is withdrawn: a smaller denominator raises a rate when the numerator holds, and 39 unsupported lines over the retained attempt's 240 cited lines would be 16.25 per 100, above the first attempt's 9.90. The whole fall came from the numerator. The instinct to say what a favourable number was hiding was right; the number offered as the answer was wrong and had not been checked. The table above is what that caveat should have been.

**What the validator lets past, which is the measurement that matters and the one this page got wrong.** Two numbers, and the order they are read in is the point.

`src/server/packet/pairs.test.ts` is a paired evaluation set. **The population, in one place: 18 lines labelled supported, 4 pending adjudication, 32 unsupported lines written by the rules' author and 14 by a second author.** It was 26 controls and 28 false lines until 19 September 2026, when four controls were found not to be supported by the facts they cite and moved (D-044, D-047) and four more were separated out as unplaced (D-052).

**Superseded on 18 September 2026 by D-034, and this paragraph still described it as current until 19 September.** It read: "It catches 28 of 28 and passes 26 of 26, asserted on every run of `npm test`. That result is not wrong and is not withdrawn." The first half stopped being true when the meaning comparison was removed. The file asserts 18 of 18 supported lines pass and names the lines the invention check still rejects; it asserts nothing about the 32 unsupported lines, nothing about the second author's 14, and nothing about the 4 pending, on purpose, under a header saying it is not evidence that fabrication is caught. The regression floor it provides is now a floor under the truthful controls and the few rejections, not under the whole set.

The 28 of 28 was a real result on 17 and 18 September 2026, under the claim validator that D-034 removed. Population: one author's fixtures, that author being the author of the rules.

On 18 September 2026 a second author, reading the implementation and writing against it, produced 14 false lines of their own. **The validator missed all 14**, before any of the fixes that followed. Every one was reproduced against the real validator before anything was changed. `pairs.test.ts` marks each case with who wrote it and prints the two counts separately, never summed; the 14 join it as each rule change lands, so the independent count reads 0 of 0 until then and the file says so.

| Evaluation set | False lines caught |
|---|---|
| Written by the rules' author, under the rules of 18 September 2026, now removed | 28 of 28 |
| Written by the rules' author, under the rules as they stand | 8 of 32 flagged, 4 of them rejected |
| Written by a second author, independently | **0 of 14** |

So this page previously said the miss rate was 0. It was 0 on one author's fixtures and the page did not say the second half loudly enough, because the second half did not exist yet. **The only miss rate measured against someone who did not write the rules is 14 of 14 missed**, from the one independent attempt anyone has made. The paired set demonstrates coverage of its own fixtures and says nothing about the general rate. Neither number is an accuracy claim about real resumes, and the diverse labelled set review four asked for still does not exist.

One of those 14 is worth its own line, because it is narrower and stranger than it was reported. The normaliser reads three dash characters three different ways, and only one of them turns a loss into a gain:

| Written | Read as | Effect |
|---|---|---|
| `-11 percent` hyphen minus | `-11 percent` | sign kept |
| `–11 percent` en dash | `11 percent` | **a loss silently becomes a gain** |
| `‒11 percent` figure dash | unread | held, not silently changed |

A resume pasted from a word processor is exactly where an en dash comes from. Whatever the rule becomes, it needs a test per dash character rather than one test for "a negative number".

And of the 48 retries in the 80 job sample, 2 substituted words as the prompt asks, 2 reverted to the base resume and 37 dropped edited lines (D-029, `design/snapshots/2026-09-18-packets/reconciliation.md`): a ready packet after a retry is not evidence that the held claim was corrected.

**DOC-03 stays a gate and stops being a queue (D-034).** At three in ten held, the packet review screen was a primary flow, designed and staffed as such. At 7.5 percent rejected and nothing held, it is not: there is no queue of flagged packets to work through. It stays a gate before submission for a reason that does not depend on the rate at all, and the reason is the user's: a person should see what goes out in their name. So every packet passes through DOC-03 and almost none of them arrives with anything flagged.

That changes what the screen is. It was "the validator thinks these lines are wrong, decide"; it is now "here is your tailored resume, approve it", with a rejected packet offering the original instead. The review volume is 100 percent either way; what fell is the share arriving with a finding attached.

It also changes what the gate is worth. The validator used to be able to say something about a particular line; it no longer can, and the tailoring prompt is the only thing between a model that wants to sound impressive and a submitted resume. The person at DOC-03 is the last check that reads meaning at all, which is an argument for the gate, not against it.

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
