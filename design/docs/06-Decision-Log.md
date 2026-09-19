# Jobluvo, decision log

Decisions taken during build that the other documents assume but do not state. Newest first. Each entry says what was decided, what it was measured against, and what it forbids.

Companions: [Product BRD](01-Product-BRD.md), [Implementation plan](02-Implementation-Plan.md), [ATS integration plan](04-Job-Parsing-and-ATS-Integration.md)

---

## The validator's principle

> **A tailored line may change how something is said. It may not change what is being claimed.**

This is the user's decision, not an engineering one. It is still the right statement of
what is and is not allowed, and it is still at the top of this log because every entry
below is answerable to it.

**What carries it changed on 18 September 2026 (D-034). The prompt carries this, the code
does not enforce it.** The meaning comparison was removed: no rule in
`src/server/packet/` now reads what a tailored line means and compares it with what a fact
means. The four prohibitions in `RULES` in `src/server/packet/tailor.ts` are cases 2, 3, 4
and 0 below, written out in plain language with one example each, and they are the whole of
what stands between a model that wants to sound impressive and a submitted resume. The code
checks one thing: that every value and every name appears somewhere in the confirmed facts.

Read the cases below as the standard the prompt is held to, not as a description of
anything the validator verifies. D-034 records what that costs in measured numbers.

Why it is here at all. The validator was built as a pile of individual rules, each one
added to catch an example somebody found. There was never a written statement of what it
is for, which is why every review found a new seam and why nobody could judge whether a
proposed rule was right or merely effective on the one case that prompted it. Five
reviews and thirty odd findings is what that costs.

**Case 1. Stronger wording, the same claim. Allowed.** Shortening, using the posting's word
where the fact already supports it, and leading with a different fact. This is what tailoring
is for, and a rule that blocks it is wrong however many inventions it also catches. This is
not hypothetical: rule 1's first design held 67 of 90 packets and was withdrawn for exactly
this, because it measured rewording and tailoring is rewording (D-022).

| The fact says | A case 1 rewrite | What changed |
|---|---|---|
| "Made a tool for tracking candidate pipelines" | "Built a candidate pipeline tracker" | shorter, and the posting's noun. Same actor, same scope |
| "Presented findings to the executive committee every quarter" | "Reported quarterly to the executive committee" | the posting's verb. Same frequency, same audience |
| "Ran the pricing workstream of a telecom relaunch, with a conjoint study of 2,000 customers" | "On a telecom relaunch, ran the pricing workstream with a 2,000 customer conjoint study" | a different fact leads. The activity stays attached to the workstream |

**These replace two examples that contradicted case 3, corrected on 19 September 2026
(D-041).** This paragraph used to offer "helped deliver" to "delivered" and "improved" to
"drove" as permitted strengthening. Both are promotions on this log's own reading: dropping
"helped" claims sole responsibility, and "drove" claims the person led the thing. Case 3 two
paragraphs below forbids precisely that, and the prompt's own rule says "contributed to does
not become owned". The examples were wrong, not the cases.

**Case 2. The same number attached to a different thing. Not allowed.** "Reduced churn
by 11 percent and cut acquisition cost by 5" becoming "reduced acquisition cost by 11
percent". Nothing was invented, every word appears in the fact, and the achievement is
false. A number belongs to its subject and moving it is a fabrication.

**Case 3. The same work at a higher level of authority. Not allowed.** "Trained 6
analysts" to "managed 6 analysts". "Supported recruitment" to "led recruitment". No
number moved and no word was invented, but the person now claims they ran something they
took part in. A recruiter reads that as a lie in the same way as case 2, and it is
exactly what a model does when told to sound stronger.

### What this changes about how the work is done

**Every rule proposed from here says which case it serves, and what it would wrongly
block in case 1.** A rule that cannot say what it costs in case 1 is not ready to ship.

**Every case in `pairs.test.ts` is labelled with the case it belongs to**, truthful
controls as case 1, and the set is reported by case rather than as one number. "28 of
28" hid the fact that nobody had written a case 3 test at all.

**Every measured delta says which case its newly held packets belong to**: case 2, case
3, or case 1 caught by mistake. The total is not the number to report.

**If a rule change seems to require breaking this, that is a product decision and it
goes back to the user.** It is not resolved in code and not resolved by argument in a
pull request.

### What labelling the existing set by case immediately showed

The 28 false lines of `pairs.test.ts`, labelled against the principle and counted by
case rather than summed:

| Case | False lines |
|---|---|
| invention, a value or entity in no cited fact at all | 17 |
| case 2, a number moved to another subject | 8 |
| polarity | 2 |
| **case 3, the same work at a higher authority** | **1** |

Seventeen of the twenty eight test the thing nobody disputes. Case 3, the one a model
reaches for every time it is told to sound stronger, had a single line: "Trained 6
analysts" becoming "Managed 6 analysts". "28 of 28" was true and told nobody this. The
user said the count hid that case 3 was barely tested; labelling says by how much.

Two labels were wrong on the first pass, both in the same direction, and correcting them
is why the case is recorded per line and not per pair. "Hired 6 analysts" from "Trained
6 analysts" is a different activity, not a promotion, and the three lines under finding
6 take another employer's work rather than promoting this employer's. Left as case 3
they would have made the thinnest column look four times healthier than it is.

### Case 0 and case 4, named by the user after labelling turned them up

Labelling the existing set against the principle turned up two kinds that fit the sentence
at the top and none of the three named cases. Neither was forced into an existing case,
because quietly widening a case is how a principle stops meaning anything. Both were put to
the user and both were named.

**Case 0. Something in no confirmed fact at all. Not allowed.** A value, entity, tool or
qualification the user never claimed anywhere. It is numbered 0 rather than 4 because it is
the one case where there is nothing to compare against: the others ask whether a claim
survived a rewording, and this one asks whether there was a claim at all. Cases 1, 2 and 3
keep the numbers they already had here and in CLAUDE.md; nothing was renumbered.

**Case 4. Polarity. Not allowed.** A denial reversed, or a loss published as a gain. "Did
not manage 6 analysts" becoming "Managed 6 analysts"; "-11 percent revenue growth" becoming
"11 percent revenue growth" when a leading en dash is dropped. Nothing is invented, no
number moves, the claim is negated. It fails the principle's test plainly and it is not
case 2 or case 3.

Naming both mattered for a plain reason: most of `pairs.test.ts` is case 0, and counting it
beside case 3 is what produced the misleading "28 of 28".

Two labels were wrong on the first pass, both in the direction that flattered case 3, and
correcting them is why the case is recorded per line and not per pair. "Hired 6 analysts"
from "Trained 6 analysts" is a different activity, not a promotion, and the three lines
under finding 6 take another employer's work rather than promoting this employer's. Left as
case 3 they would have made the thinnest column look four times healthier than it is. That
is recorded here on the user's instruction: getting two labels wrong and saying so is worth
more than getting them right quietly.

## 19 September 2026

### D-049. The replay revoked a row on one pass and promoted it on the next, and the rebuttal that closed the finding checked one of the two cases

The eighth review's finding 3, verified by the user against the code. It reopens a finding this
project closed as impossible, and **the reason it was closed wrongly is the part worth keeping**.

**The defect.** A row that is `ready` with **no resume** and a full change set:

| Pass | What happens |
|---|---|
| 1 | `!row.resume` enters the unverifiable branch; the row is `ready`, so it is revoked to `invalid` with a hard `unverifiable-resume` finding |
| 2 | the row is now `invalid`, so the revoke, which is guarded on `ready` or `needs_review`, is skipped; `retainedFindings` keeps only summary findings so the hard finding is gone; the replayed status comes back `ready`; the rebuild branch fires on `!row.resume && candidate && coverage === "full"` and stamps it **ready** |

Revoked on one pass, promoted on the next, over identical inputs, with the finding that revoked
it silently dropped on the way. Reproduced before the fix.

**Why the rebuttal was wrong, which matters more than the defect.** The seventh review named two
cases: a ready row with a **missing** resume and one with a **mismatched** resume. The rebuttal
built a row with a mismatched resume, traced it, found it falls to `no_resume` rather than being
promoted, and concluded the whole finding could not happen. It then recorded that conclusion in
D-048's item 15 as verified against the code, and renamed the placement around it.

Every step of that was done properly except the first. The trace was right, the branch guard was
read rather than assumed, the result was reported with the code path. **It answered one of the
two cases the finding named and was written up as answering the finding.** "Verified against the
code" was true of what was checked and said nothing about what was not. A rebuttal has to cover
every case the finding names, and saying which cases were checked is part of the rebuttal, not a
detail. D-048's item 15 is corrected rather than deleted, so the mistake stays findable.

**The fix, and it is an ordering.** The rebuild is now asked **before** the revoke. A row with no
document that stores the change set it was built from rebuilds from base plus that change set
whatever its status, so the first pass gives the answer the second pass used to give, and the two
agree. A row that cannot rebuild itself, which means a bullets only row with no change set, is
still revoked exactly as before.

**The property that was missing, now asserted.** Not a case but an invariant: reading a row twice
says the same thing. `replay.test.ts` reads five shapes three times each, feeding every decision
back onto the row, and asserts the status and the presence of a document settle on the first pass
and stay:

| Shape | Before | After |
|---|---|---|
| ready, no resume, full change set | ready/none, invalid/none, **ready/document** | ready/document from pass 1 |
| ready, no resume, bullets only | invalid/none, stable | unchanged |
| ready, mismatched resume | invalid/document, stable | unchanged |
| invalid, no resume, full change set | ready/document, stable | unchanged |
| ready, resume matches | ready/document, stable | unchanged |

Only the first row moves, and it is the defect.

**Measured before shipping: no stored row moves.** 83 ready, 22 held, 2 invalid, unchanged. No
live row is `ready` with a missing resume, which is why this never showed up in a restamp table
and had to be found by reading the branch.

### D-048. The repair's provenance claim is narrowed to what it establishes, the case 1 example stops making the mistake it warns against, and the rest of the seventh review is placed

The seventh review's findings 2, 3's remainder and 11, plus its deferrals. No code changes with
this entry; two of its three parts are corrections to claims, which is what the user asked for
instead of machinery.

**1. What the repair guard establishes, and what it does not.**

D-043 said the source is named on the row and read as though the document's identity had been
established. The review is right on both halves and the user confirmed both.

- The guard proves the offered document is **consistent with the row's own stored changes**. Any
  document those changes could produce passes the same test, so it does not prove these bytes
  are the artifact that row historically held.
- The summary is the weakest part of it. It is taken from the offered document and then compared
  against a candidate built with that same summary, so **the summary cannot fail the test**.
- The hash the source recorded goes into a finding's detail and **is never checked** against the
  document.
- The finding itself is not retained by a replay, because only summary findings survive one.

**And that last point is not hypothetical: it has already happened.** The repair was applied on
19 September and the r10 restamp of the same day dropped `resume-repaired` from all four rows.
Checked, not assumed: the four rows carry their documents and nothing on them says where those
documents came from. Their provenance now lives in this log and in the cost summary, and nowhere
in the database.

**Nothing is built for this, on the user's instruction, and the reason is worth keeping.** The
path has run once, on four rows of a demo profile. Verifiable durable provenance is real work
and building it now would be machinery for a path nobody is using. The claim is weakened instead,
here and in the cost summary, and the work is placed in phase 1 beside the reconstruction items.
**If a repair is ever needed on a real user's row, that work happens first.**

**2. The case 1 example made the mistake it warns against.**

D-041's third example was "Ran the pricing workstream of a telecom relaunch, with a conjoint
study of 2,000 customers" becoming "Ran a conjoint study of 2,000 customers for a telecom pricing
relaunch". That assigns ownership of the study, which is exactly the case 3 line D-044 moved out
of the controls three entries ago. **The same trap twice, in the entry written to fix it.**

Corrected to "On a telecom relaunch, ran the pricing workstream with a 2,000 customer conjoint
study": a different fact leads and the activity stays attached to the workstream. The example is
documentation only and no prompt carries it, which is why it survived a round of review.

**3. The rest of the seventh review, placed in phase 1, in its recommended order.**

12. **The parser truncation and the change cap.** Finding 6.
13. **The raw answer is overwritten by the merged one before it is logged.** Finding 7. What the
    model actually returned on a retry is not recoverable from the row, which is the limit D-039
    recorded from the other side.
14. **Document mode loses the skill order.** Finding 8. `readAnswer` builds its change set with
    `skills: []`, so a document mode answer's ordering is dropped on the way into the row.
15. **A revoked row is never re-examined, under a branch named for rows that have no document.**
    Finding 9. *(Corrected 19 September 2026 by D-049. This item said the finding it replaced
    "no longer fits the code" and that a revoked row **cannot be promoted**. That was wrong: it
    was checked against one of the two cases the review named, and the other one promoted. The
    promotion half is not placed, it is fixed, and D-049 has it. What remains here is the
    mislabel below, which is real and is still open.)*

    A revoked row that cannot rebuild itself keeps its document (D-038), so on the next pass it
    reaches `no_resume`: **a branch named for a row that has no document, while the row is
    holding one.** Nothing is written, so **the row is never re-examined by any later pass**, and
    the report prints **"passes as ready but no resume stored" about a row with a resume.** A
    mislabel and a silent dead end.
16. **The report omits repairs from its totals.** Finding 12, and the same shape as item 4's
    rebuilds: `repaired` is counted and not carried into the totals the report prints.
17. **The remaining contradictions in the current state section.** Finding 13.
18. **The evaluation design.** Finding 14, and the one to read properly when phase 1 opens
    rather than to action piecemeal. Its argument, which the user endorsed: another set of
    supplied false sentences measures the checker and not the prompt, and the only real test is
    generating answers from frozen inputs with a person judging them. It also observes that
    changing the self check, the retry protocol and the example together measures a configuration
    rather than any one change, which is exactly what the first paid run is scheduled to do to
    three changes at once (D-041). **That is now a decision rather than an open tension**: the
    first run measures the configuration on purpose, because no baseline exists and the first
    question is whether the prompt as a whole holds up, not which paragraph earned it. If the
    result is ambiguous or worse than expected, the second run splits it. D-041 carries the
    reason and, more importantly, the list of things that run will not establish.
19. **Verifiable durable provenance for a repaired row**, from part 1 above, beside the
    reconstruction items. Needed before any repair touches a real user's row.

**The first phase 1 item is still the pre rank.** Nothing here changes that.

### D-047. The standard for a truthful control is written down, the rest are audited against it, and what cannot be placed is marked rather than guessed

The seventh review's finding 3, and the user's instruction with it: this is the third round of
corrections to this file's labels, so do it properly.

**The standard, which had never been written down.** A line belongs in the truthful controls
when **every element of it is supported by the facts it cites**. Not when it is plausible, not
when the person probably did it, not when nobody would mind. The first three rounds of labelling
used the second test without saying so, which is how two case 3 lines survived a week and two
inventions survived three audits.

`pairs.test.ts` cannot know whether a thing happened. It knows what the facts say. "Built
dashboards in Excel" does not say who the dashboards were for, so a control that names a
beneficiary is not supported by it, whatever the truth of the matter.

**Two moved, both invention rather than authority.** The previous round looked only for
authority inflation and found two case 3 lines. This one looked for additions:

| The fact says | The control | What it adds |
|---|---|---|
| "Built dashboards in Excel." | "Built dashboards in Excel for the sales team." | a beneficiary no fact names |
| "Built dashboards in Excel." | "Built dashboards and reports in Excel." | a second deliverable |

The second is worth its own sentence. It was the control of the pair whose whole purpose is to
test that **every conjunct of a coordinated object is checked**, and the control added a conjunct
the fact does not carry. The pair was testing the rule with an example that broke it.

**Four are marked for adjudication and left where they are, counted as controls.** Each is a real
question about what case 1 permits and none of them is a test file's to decide. They are named in
the header so nobody has to rediscover them:

| The fact says | The control | The question |
|---|---|---|
| "Trained 6 analysts." | "Coached 6 analysts." | is coaching the same activity as training |
| "Built dashboards in Excel." | "Built dashboards with attention to detail." | is a claim about the manner of the work a claim at all |
| "Ran the pricing review across 3 markets." | "Led the pricing review across 3 markets." | do "ran" and "led" sit at the same authority |
| "Ran the pricing review across 3 markets." | "Ran pricing reviews across three markets." | one review across three markets, or three reviews |

Marking them is the point of the entry as much as the two moves are. Guessing is what put the
other four in there.

**The counts, and the direction is unfavourable again**, which is what an honest audit of one's
own fixtures looks like:

| | Before D-044 | After D-044 | After D-047 |
|---|---|---|---|
| False lines, the rules' author | 28 | 30 | **32** |
| Truthful controls | 26 | 24 | **22** |
| Invention, the rules' author | 17 | 17 | **19** |
| Flagged, of 42 then 44 then 46 | 8 | 8 | **8** |

**None of the four moved lines is caught.** "Sales", "team" and "reports" all appear somewhere on
the profile, and a word anywhere on the profile satisfies the remaining check, so the flagged
count has not moved and only the denominator has. That is D-034's narrowness showing up again
rather than anything new.

The probe's copy is corrected in the same change, and its drift guard constants with it. The
guard still compares the copy with a constant rather than with the file, which is phase 1 item
10 and is untouched here.

### D-046. A span the normaliser could not read supplies no value, on either side of the check

The seventh review's findings 4 and 5. The user reproduced finding 4 himself.

**What was wrong, and it is worse than either half alone.** D-040 made an ambiguous numeric
span report itself as unreadable so a line would be held rather than rejected. It did not stop
anything reading values out of that span. `readNumbers("Raised USD 9,2 million")` returned the
phrase as unreadable, and `claimsOf` on the same string returned `money:usd:9` and
`num:2000000`: two figures nobody wrote, produced by a comma the code had just declared it
could not interpret.

Those figures then did real work in both directions. On a **fact** they stood as confirmed
evidence, so a tailored line inventing "USD 9 million" was supported by the profile. On a
**line** they were fabrications the check could reject, which is finding 5: a hard
`value-unknown` derived from a span the parser could not read.

**Marking a span uncertain and then harvesting it is the worst of the three options**, because
the fragments arrive downstream looking exactly like values somebody wrote. The comment in
`normalise.ts` said "nothing below tries to give it a value", which was false when it was
written, and it was in our own materials saying so.

**The rule.** `readNumbers` now returns `unreadableSpans`, the character ranges in its own
output that an unreadable phrase covers, and `claimsOf` emits no claim that overlaps one.
Overlap rather than containment, because a currency match starts before the digits it reads:
`usd 9` begins outside the span and ends inside it.

| Text | Claims before | Claims now |
|---|---|---|
| "Raised USD 9,2 million in Series B" | `money:usd:9`, `num:2000000` | none |
| "Grew revenue five thousand two million" | none | none |
| "Cut costs 11 percent and raised USD 9,2 million" | `pct:11`, `money:usd:9`, `num:2000000` | `pct:11` |
| "Joined in twenty ten and managed 6 analysts" | `num:6` | `num:6` |
| "a study of 2,000 customers that lifted ARPU 6 percent" | `num:2000`, `pct:6` | `num:2000`, `pct:6` |

**Numbers elsewhere in the same text still count.** One bad span does not silence a fact, which
is the line between this and the blunt alternative of discarding any text with an unreadable
phrase in it. The tests assert both directions on purpose: the intended amount is held when its
source is ambiguous, and the fragments from that source do not pass as confirmed values.

**Finding 5 needs no separate rule.** A line's ambiguous span now produces no claim, so there
is nothing for `value-unknown` to be derived from, and `number-unreadable` still holds the line
because the lookup did not run on that phrase. Other values on the same line are read normally
and can still reject: `validate.test.ts` asserts that "Raised USD 9,2 million and cut costs 40
percent" on a clean profile yields exactly one hard finding, on `pct:40`.

**Measured before shipping, and nothing moves.** Stored packets read the same, 83 ready, 22
held, 2 invalid. The 80 saved answers read the same, 74 ready, 6 held, 0 invalid, with the same
two findings firing. The 30 false lines are flagged the same, 8 of 30. No live profile or line
carries an ambiguous comma or an unreadable word number, so this is a correctness fix for data
nobody has uploaded yet, exactly as D-040 was, and it should not be quoted as an improvement to
any number.

`VALIDATOR_REVISION` is `2026-09-19.r10`. The restamp that writes it is applied from merged
code and reported with it.

### D-045. D-038 is extended to the attempt that produced nothing, and the tests stop asserting the deletion

The seventh review's finding 1, which the user reproduced and verified. D-038 said a rejection
blocks a document and does not delete it, and #86 fixed the rejection path only. Three paths
were left, and on all three the packet still came out empty.

**What was wrong.** The retained attempt was simply the last attempt. When attempt 1 was
rejected and attempt 2 never produced anything, the packet became attempt 2: no document, no
change set, no findings, status `failed`. The model's paid answer, the one a person could have
been shown beside the finding that rejected it, was gone. The same happened when the validator
itself threw on an answer that had parsed: the candidate was discarded to report a defect in
the code that was going to read it.

**The rule.** The retained attempt is the **last attempt that produced a document**, not the
last attempt. An attempt whose call never returned, or whose answer did not parse, produced
nothing to retain, and the execution failure belongs in the error text and on the attempt log,
which is where a failure belongs. The packet then carries that attempt's own number, its own
findings and its own status.

| Sequence | Packet before | Packet now |
|---|---|---|
| invalid, then malformed JSON | failed, no document, no findings | invalid, attempt 1, its document and its hard finding |
| invalid, then a transport error | failed, no document | invalid, attempt 1, its document |
| invalid, then a timeout | failed, no document | invalid, attempt 1, its document |
| parsed, then the validator threw on it | failed, no document | failed, attempt 1, its document, findings empty because nothing read it |
| held, then a failed retry | held first answer kept | unchanged, that rule already existed |
| nothing parsed at all | failed, no document | unchanged, there is nothing to keep |

None of this promotes anything. `consumableResume` serves a `ready` packet and nothing else, so
every row above is as unsendable as it was when it was empty. What changed is that the evidence
survives the verdict, which is the whole of D-038.

**The tests were enforcing what D-038 removed, and that is the part worth saying plainly.**
`expectNothingShipped` asserted that the stored row contained no trace of the rejected text,
including a string match on the invented figure. That is an assertion that the deletion happens.
It now asserts the gate: the status is not ready and nothing leaves through `consumableResume`.
**"The invention is not in the row" and "the invention cannot be submitted" are different
claims, and only the second was ever wanted.** A test suite can hold a policy in place long
after the decision that set it was reversed, and this one did, for four days, in the file whose
job is to prove the opposite.

**The regeneration case, which the review raised with it.** The upsert wrote `resume` and
`resume_hash` unconditionally, so a rerun that produced nothing replaced a stored document with
null. A run with no document of its own now keeps the one already on the row, **but only when
that row carries the same facts hash and the same content hash**. Then the row's own labels
already describe the document it is keeping and nothing is relabelled. When either input has
moved, the stored document answered a different question and it goes.

The honest limit of that, stated rather than left to be found: the kept document is from an
earlier run while the status, findings and error on the row are this one's. It is coherent
because the status in that case is always `failed`, which claims nothing about a document, and
because with the retained attempt rule above a run reaches the upsert with no document only
when not one of its attempts parsed. A row that had to describe two runs properly would need a
column, and nothing here needs one.

### D-044. Two truthful controls were case 3 false lines, and the set is 30 and 24

The user's call on the two named in D-041. Both are the same work at a higher level of
authority, which is case 3 by the principle's own definition, and running a study is not using
one.

| The fact says | The line that was a truthful control | Now |
|---|---|---|
| "Used Salesforce for the sales pipeline." | "Used Salesforce to run the sales pipeline." | a case 3 false line of that pair |
| "Delivered 9 growth projects for banks, using a conjoint study of 2,000 customers that lifted ARPU 6 percent." | "Ran a conjoint study of 2000 customers that lifted ARPU 6 percent." | a case 3 false line of that pair |

**Why it mattered more than two lines.** A truthful control is a line a future rule must not
block, asserted on every run of `npm test`. A control that is itself case 3 would have vetoed
any rule built to catch case 3, which is the thinnest column in the set. The set would have
been enforcing that the thing it is thinnest on must be allowed.

**What it does to the counts**, and the direction is unfavourable, which is why it is worth
doing:

| | Before | After |
|---|---|---|
| False lines, the rules' author | 28 | 30 |
| Truthful case 1 controls | 26 | 24 |
| Case 3, the rules' author | 1 | 3 |
| Flagged, of all 42 then 44 | 8 | 8 |
| Rejected | 4 | 4 |

**Neither new false line is caught**, so the flagged count does not move and the denominator
does. Case 3 now stands at 0 of 6 rejected and 0 held, counting both authors. That is the
ordinary state of a case 3 line here: no rule reads what a line means, so nothing can see a
promotion, and the tailoring prompt's third prohibition is the whole of what stands against it.

**Neither line is removed.** The file's rule is that a pair is never removed, only added to,
and both lines are still in the file, in their own pairs, with a comment saying what they were
and why they moved.

### D-043. The four rows whose document exists are repaired, through a path in the code rather than a one off script

The user's call, and his reason in his words: leaving four rows that say invalid with no
document, when the document exists in a verified snapshot that is in version control, is the
same kind of untruth this week has been spent removing.

**What was true before this.** D-037 rebuilt seven of thirteen rejected rows from their own
stored change sets and left six invalid, because those six store no change set and nothing
could reconstruct them. That was right about reconstruction and wrong about existence: four of
the six have their document in `design/snapshots/2026-09-18-packets`, frozen at 12:00 UTC on 18
September, before the r7 restamp cleared the database copies. Two never had one.

**It is a repair path, not a write.** The review asked for an explicit recorded repair and each
of its four conditions is met by construction rather than by care:

| The condition | How |
|---|---|
| the source is named on the row | a soft `resume-repaired` finding carrying the file path and the hash that source recorded. **This did not hold, and D-048 corrects it: the finding was gone from all four rows by the end of the same day, dropped by the r10 restamp, before anyone noticed** |
| the document is validated under today's rules before any status is decided | the repair branch runs after the validator has read the change set, and the status is `statusOf` over those findings like every other row |
| nothing is promoted by hand | no branch here can produce `ready` that the validator did not produce. A repaired row that holds, holds; one that is rejected stays rejected and keeps its document |
| the repair is a branch in the code | `kind: "repair"` in `replayDecision`, reached by `npm run validator-report -- --repair-from <dir>`, with tests. No script was written and none is needed again |

**The offered document is not trusted for being in the repository.** It is accepted only when
the row's own stored changes, plus that document's own summary, reproduce it exactly. That is
the same test a legacy row's stored resume has to pass to be restamped at all, and it is review
five's finding 6 unchanged: the inputs are on the row, the function is deterministic, and the
result is validated again before anything is stamped. A document that fails it is refused
however good the source, and the tests assert that with a document from the right file and the
wrong row.

**What that test does and does not establish, narrowed by D-048 after the seventh review.** It
establishes that the offered document is **consistent with the row's stored changes**. It does
not establish that these bytes are the artifact that row historically held: any document those
changes could produce passes it equally. The summary is a weaker part still, because it is taken
from the offered document and then compared against a candidate built with that same summary, so
it cannot fail. And the hash the source recorded is written into a finding's detail and is never
checked against the document. Read the guard as a compatibility check, which is what it is.

**What the outside file supplies that the row cannot is the summary text**, which is why these
four could not be rebuilt from themselves. Nothing supplies the facts that summary cited, so
the summary is not revalidated and the row is held on `summary-not-revalidated`, exactly as
every other row with no change set. A restored summary is never stamped as read when nothing
read it.

**What it does, read only before applying.** All four verify against their own stored changes.
All four come back **held**, none ready:

| Packet | Finding that had rejected it | After the repair |
|---|---|---|
| 01b8f46b | posting word, "roadmap" | needs_review, document restored |
| b40e9ede | posting word, "members" | needs_review, document restored |
| 96e3b4bf | posting word, "relationships" | needs_review, document restored |
| 433b326a | name, "KPI" | needs_review, document restored |
| d5684230 | `value-not-in-cited`, `num:6` | unchanged, no document exists |
| 2e4fdc00 | `value-not-in-cited`, `num:6` | unchanged, no document exists |

The two that stay invalid stay invalid because no document exists for them, which is honest and
is the point: the repair restores what is there and invents nothing.

**Applied 19 September 2026 from merged code (98b610c).** Before: 83 ready, 18 held, 6 invalid.
After: **83 ready, 22 held, 2 invalid.** 105 rows written, 4 changed status, 4 repaired, 2 left
as they are, 0 revoked, 0 stale. The four moved from invalid to needs_review and each carries
the source and hash on the row:

| Packet | Source hash recorded | Held by |
|---|---|---|
| 01b8f46b | dbdfc737... | posting word, "roadmap" |
| b40e9ede | 968dda58... | posting word, "members", and a summary nothing revalidated |
| 96e3b4bf | 1ad14acd... | posting word, "relationships" |
| 433b326a | 1b66028e... | name, "KPI", and a summary nothing revalidated |

Every row in the packets table now carries a document except the two that never had one, which
is the first time that has been true since 18 September.

**One judgement call, flagged.** A repair whose document validates to invalid still attaches
that document. It follows D-038: a rejection blocks a document and does not decide whether one
exists, and an invalid row with a document is not a promotion. None of the four is in that
state, so nothing turns on it today.

**Why this is worth a branch in the code rather than a script.** The user's reason, recorded
because it is the general point and the four packets are not: this is the repair path that
matters when the rows belong to real users rather than to a demo profile. A user whose tailored
document was destroyed by a rule that was later withdrawn should be repaired by something that
names its source, checks the document against the row, revalidates it, and can be run again and
audited. A script run once by whoever noticed is none of those things.

### D-042. The documents are made to agree, the rest of the sixth review is placed in phase 1, and the claim about code auditing a model is softened

The sixth review's last three items and its deferral list. No code changes with this entry.

**One current state section, and everything else dated.** The cost summary now opens with
`Current state, 19 September 2026` and every figure below it keeps its date and the population
it was measured on. Five things disagreed across that page, this log and CLAUDE.md, and each is
now stated once:

| What disagreed | What is true |
|---|---|
| the ready, held and invalid counts | 83 ready, 18 held, 6 invalid, at r9, restated at the top of the cost summary |
| whether a held rate exists | it does: 18 of 101, 17.8 percent. "There is no held rate any more" was true for one day under D-034 and D-036 ended it the next |
| whether `pairs.test.ts` catches 28 of 28 | it did until D-034 and the page went on saying so. It now asserts 26 of 26 truthful and the named rejections, and nothing about the other 34 |
| whether a missing name is hard or holds | it holds (D-036). The D-034 passage saying every remaining finding is hard is marked as superseded the next day |
| whether the claim position scope was deleted | it was not. D-034 listed D-023 among the rules that no longer exist while keeping its narrowing three paragraphs earlier, and `entities.ts` still has it |

**Two corrections the review named specifically.**

Four rejected plus four held is **eight flagged, four of them rejected**, not "four caught".
The old wording counted the rejections only and understated what the check does. The other
half is worth saying in the same breath: a held line is not a caught fabrication either,
because nobody has decided any of them.

The 107 stored rows are **two profiles and not one comparable population**: 80 on
`c9f231127f13` and 27 on `c70bf9c31851`, tailored under different prompts, validator revisions
and fact sets. A rate over all 107 divides one population's outcomes by two populations' size.

**The self check cost is relabelled** and so is the retry prompt's. What is measured is a
character count; the token count is an estimate; two calls a packet is a ceiling, not an
average; the output side is unmeasured. The conclusion, that it does not move the cost per
packet meaningfully, survives the relabelling.

**The r9 restamp, applied 19 September 2026 from merged code.** Before, r8: 83 ready, 18 held,
6 invalid. After, r9: 83 ready, 18 held, 6 invalid. 101 rows written, **0 changed status**, 0
revoked, 0 held, 0 rebuilt, 0 stale, 6 left as they are with no candidate to restamp. **No row
moved, and none was expected to**: D-040 changes what happens on a profile carrying an
unreadable number phrase and neither live profile carries one.

**The framing on code auditing a model is softened, not withdrawn.** D-036 said "code cannot
audit a model". The evidence supports something narrower and still decisive: a hand written
checker was rewritten five times across five reviews, and a second author reading the
implementation got fourteen of fourteen false lines past it. That is a reason to stop buying
this approach, not a proof that no code could do it. D-036 now says that.

### The rest of the sixth review, placed in phase 1

Recorded in the user's priority order so it is answered rather than forgotten. None of these
is a defect a user meets today; every one is in the measurement and replay apparatus, which is
where the phase 1 work is. They join the seven D-035 placed.

1. **The replay revokes on one pass and promotes on the next.** The same row can be revoked
   for an unverifiable document and then, on a later pass, treated as promotable. The decision
   function is not idempotent across passes over changing inputs. *(Superseded 19 September 2026
   by D-048's item 15, which checked the branch guard rather than the description: a revoked row
   is `invalid`, the revoke branch is guarded on `ready` or `needs_review`, so it can be neither
   revoked again nor promoted. The real defect is narrower and is filed under its own name.)*
2. **Reconstruction provenance, including `sameDocument` sorting skills on full coverage
   rows.** A rebuilt candidate is compared with the skills sorted, which is right for a legacy
   row that never stored an order and wrong for a full coverage row that did: it can call two
   documents the same when the order the model chose differs.
3. **The extraction race infers replacement from mutable fact status.** Whether an extraction
   replaces an earlier one is read off a status that another write can change underneath it.
4. **The report omits rebuilds from its totals.** `rebuilt` is counted and then not carried
   into the totals the report prints, so a run that rebuilt rows describes itself as having
   touched fewer than it did.
5. **The time of check gap between reading job hashes and writing.** The posting text can move
   between the read that decides a packet is current and the write that stamps it.
6. **The reconcile script calls a cleared finding a truthful correction.** A finding that is
   gone because its rule was withdrawn is counted as the retry having fixed the line.
7. **Partial extraction discards data without raising an issue.** Already on D-035's list from
   review five, repeated by this review, still needing the phase 1 extraction work.
8. **The database tests are not isolated from ordinary data.** They run in rolled back
   transactions against the same database, so a failure can leave a test reading rows it did
   not write.

Three more were added on 19 September 2026, after the entries above were written:

9. **The suite fails intermittently and the cause is not established.** Added on the user's
   instruction, and it is the one on this list most likely to cost real time. What is known:
   it hits a different test each run, always a database timeout, never the same one twice, and
   an immediate rerun passes. Neon's median round trip is 187 ms with p90 spikes of 590 to 790
   ms. A real pool defect was found and fixed on 18 September, `endPool` now ending the pool
   and clearing the module global with eight test files calling it, and **that did not close
   it**: it bit twice more on 19 September, both times on a file the branch had not touched.
   The ten run before and after baseline that would have said whether the pool fix helped was
   never taken, cancelled as not worth the hour. **It is worth the hour now.** Phase 1 has far
   more branches than this week did, and a failure on one run in two costs more there than
   here, both in time and in the habit it teaches of rerunning a red check instead of reading
   it.
10. **`probe-cheap-check`'s drift guard cannot see the drift it is named for.** The script
    holds its own copy of `pairs.test.ts` and compares that copy with a hardcoded count rather
    than with the file, so D-044 moved two lines in the file and the guard passed unchanged.
    The copy and the constants were corrected by hand; the guard that was supposed to make that
    unnecessary was not.
11. **`RULES` has no case 1 example**, four prohibitions and nothing showing what a permitted
    rewrite looks like. One is added and measured with the first paid run, because every change
    to `RULES` is paid on every call (D-041).

**The first phase 1 item is still the pre rank**, because it is the lever on the term that
dominates the cost function, and because the checking model call of D-036 waits behind it.
That order is unchanged by anything here.

**Three things get measured by the first paid run and are listed together so one run does all
of them**: the output side of the p4 self check, the output side of the p5 retry block, and a
case 1 example in `RULES`.

### D-041. The case 1 examples contradicted case 3, and two truthful controls sit close to the same line

The user's call on the replacements, from the sixth review's item 4, which is why they were
put to him before shipping rather than chosen here: case 1 is his rule.

**What was wrong.** Case 1 offered "helped deliver" to "delivered" and "improved" to "drove"
as examples of permitted strengthening. Both read as promotions. Dropping "helped" claims
sole responsibility for something the fact says was shared, and "drove" claims the person led
it. Case 3, three paragraphs later, forbids exactly that, and `RULES` in
`src/server/packet/tailor.ts` says "contributed to does not become owned" in as many words.
The principle was sound and its own illustrations broke it.

**The replacements, chosen by the user from three offered.** They change wording, structure
and the order facts are given in, and none of them touches the actor, the scope, the level,
a number or a polarity. They are in the case 1 paragraph above.

**A correction to where the review placed this.** The review said the prompt offers those
examples. It does not: they were only ever in this log, and `RULES` has no case 1 example at
all, only the four prohibitions with one example each. So the contradiction was between this
document and itself, and the prompt was never sent either line. The prompt is unchanged by
this entry, deliberately: adding a positive example would change the input of every paid call
and nobody asked for that.

**That is a scheduled decision and not an omission, confirmed by the user on 19 September
2026.** `RULES` carries four prohibitions with one example each and nothing showing what a
permitted rewrite looks like, which is a real asymmetry: the model is told four ways to be
wrong and no way to be right. The reason not to fix it today is that every change to `RULES`
is paid on every call and this one cannot be measured without a paid run. **So a case 1
example is added and measured with the first paid run of phase 1**, in the same run that
measures the output side of the p4 self check and the p5 retry block.

**The first run measures the configuration, not the three changes in it, and that is the
decision rather than an accident of scheduling (the user's call, 19 September 2026).** The
seventh review is right that the self check, the retry protocol and the example moving together
cannot be attributed to any one of them. The answer is that attribution is the second question
and there is no answer to the first one yet. **There is no baseline at all today.** Nothing has
ever measured whether this prompt produces answers a person would accept, on any population, so
the question worth the first paid run is whether the prompt as a whole does that, not which
paragraph earned it. A configuration result answers that. **If it comes back ambiguous, or worse
than expected, the second run splits it, and that is when attribution is worth paying for.**

**What the first run will establish:**

- whether the prompt as it stands produces fewer unsupported claims than a person reading the
  answers would accept, judged by that person against frozen inputs;
- the output token cost of the configuration, which is unmeasured for p4 and for p5 alike, and
  therefore the real cost per attempted packet under the policy that ships;
- a baseline that later runs can be read against, which is the thing that does not exist.

**What the first run will not establish, and this list is here so that nobody quotes it for any
of them:**

- **that the self check works.** No sentence of the form "the self check catches X" can be
  supported by this run. The same is true of the retry protocol and of the case 1 example. Three
  changes moved together and the result belongs to all three or to none;
- which of the three is carrying the result, or whether any of them is carrying it alone, or
  whether one of them is making things worse and another is hiding it;
- anything about the independent checking call of D-036, which is not in this configuration and
  is not built. The run measures a prompt, not a checker;
- a general rate. One profile, one draw, one judge.

It is on the phase 1 list with the other two, as one item and not three.

**Found while doing this, recorded rather than fixed, because it is the user's to decide.**
`pairs.test.ts` asserts that 26 truthful lines must pass, and they are case 1 by definition.
Two of them sit close to the case 3 line:

| The fact says | The control that must pass | The question |
|---|---|---|
| "Used Salesforce for the sales pipeline." | "Used Salesforce to run the sales pipeline." | the fact does not say the person ran the pipeline |
| "Delivered 9 growth projects for banks, using a conjoint study of 2,000 customers..." | "Ran a conjoint study of 2000 customers that lifted ARPU 6 percent." | "using" becomes "ran": the fact does not say who ran the study |

Neither is forced into a case here and neither is removed, which the file's own rule forbids.
They are named because of what they would cost later: every one of those 26 is a line a
future rule must not block, so a control that is really a case 3 line would quietly veto any
rule built to catch case 3, which is the thinnest column in the set. A third, "Ran the
pricing review" becoming "Led the pricing review", was considered and is not listed: those two
verbs sit at the same authority and the fact already says the person ran it.

The header of `pairs.test.ts` now names the two, so nobody reads "26 of 26 truthful pass" as
evidence that the control set is conservative.

### D-040. A figure is certain only when the profile's own figures could be read, so `value-unknown` holds when any of them could not

The user's call, from the sixth review's item 3. D-036 lets exactly one finding reject a
packet, and the argument for it is one sentence: a figure either appears on the profile or it
does not, so the answer is certain. That is true of the profile. It was not true of this
code.

**Why.** The lookup compares parsed values. A fact whose own number the normaliser could not
read contributes no value to compare against, so "no fact carries this figure" could mean
"the fact that carries it could not be read". `factSet` already computed which facts those
are, kept the map, and no check ever consulted it.

**Two cases, both reproduced before anything was changed.**

| The fact says | It parses to | The truthful line | What happened |
|---|---|---|---|
| "Joined in twenty ten" | nothing; reported unreadable | "Joined in 2010" | rejected, and the packet lost its document |
| "USD 9,2 million" | USD 9 and a separate 2000000; reported nothing | "USD 9.2 million" | rejected |

**The rule.** `value-unknown` is hard while every number on the profile was readable, and
review otherwise. The finding says which it is: the held one reads "value matches no readable
fact, and a number phrase on the profile could not be read" and names the phrases. It is not
on `ACTIONABLE`, so a held value buys no second paid call, which is right for a different
reason than D-036's: a retry cannot make a fact readable.

**The scope is profile wide, which is wider than the review asked for, and the user chose
it.** The review said to route on the cited facts. The lookup is profile wide, so the fact
that would have supported a line need not be one the line cites, and a cited-facts rule would
still have rejected a line whose support sits in an uncited unreadable fact. The two differ by
nothing on the data on hand: neither live profile carries an unreadable phrase.

**The second case needed a fix the review's own prescription did not reach, and this is a
judgement call made rather than asked.** Routing on `facts.unreadable` fixes "twenty ten",
which is reported, and does nothing for "USD 9,2 million", which is not: the separator rule
strips a comma only before whole groups of three, and the rest of the pipeline then read "9"
and "2 million" without complaint. A comma left between digits is now reported as unreadable,
with the scale word after it so the phrase reads as written. Nothing tries to decide whether
that comma is a decimal point or a typed separator, because the text does not say and either
guess invents a figure the user did not write.

**What it costs, and it is a real cost rather than a free correction.** On a profile carrying
any unreadable number phrase, a genuinely invented figure is held for a person instead of
rejected. `validate.test.ts` asserts exactly that, on the profile where "five thousand two
million" cannot be read: "Managed 8 teams" against facts of 3 and 5 is still found, and it is
now held. The same line on a profile whose numbers all read is still rejected. That is the
general rule of D-036 applied honestly rather than selectively: the finding cannot say whether
the absence of a match is the line's fault or the evidence's, so it holds.

**Measured before shipping, and the measurement is that nothing moves.** Both live profiles
carry zero unreadable phrases; their only `digit,digit` sequences are 2,400 and 2,000, which
are genuine separators. Over the 80 saved answers of
`design/snapshots/2026-09-18-packets` the table is unchanged at 74 ready, 6 held, 0 invalid,
and no `value-unknown` fires at all. The stored packets read the same under r9 as under r8:
83 ready, 18 held, 6 invalid, no row moving. So this is a correctness fix for profiles nobody
has uploaded yet, and it should not be reported as an improvement to any number.

**How often a plain thousands separator now lands as unreadable, measured on the user's
question.** If that were common the demotion would become the normal case rather than the
exception, and `value-unknown` would stop rejecting anything in practice. It is not:

| Population | `digit,digit` sequences | Read as a separator | Marked unreadable |
|---|---|---|---|
| The 107 job postings behind the stored packets, 48 of which contain one | 109 | 109 | **0** |
| The two live profiles' facts | 4 | 4 | **0** |

Every well formed separator is stripped before the check runs, whatever the number of groups:
"1,000", "9,200", "252,000", "1,234,567" and "USD 150,000 to 175,000" all read as numbers. What
is marked is what is genuinely ambiguous or malformed: "9,2", "9,25", "10,00", "1,23456", and
"1,000,00", which reads its first group as a separator and marks the leftover. So the demotion
stays the exception, and a profile written in the ordinary way never triggers it.

`VALIDATOR_REVISION` is `2026-09-19.r9`. The restamp that writes it is applied from merged
code and its table is reported with the rest.

### D-039. A line the retry names is the model's decision, and the merge stops overriding it

The user's call, from the sixth review's item 2. It is damage this project created in the
same week: the self check went into the prompt on 19 September (D-036, #82) and the merge
that undoes it went in on 18 September (review five's finding 8, #79).

**What was wrong.** `mergeRetry` put back any line the retry left at the resume's base text,
as long as the validator had no finding on it. That rule was written while the validator
still read meaning, when "the validator did not object" carried information. Since D-034 it
means only "this line holds no unknown number and no unknown name", which is true of almost
every line, and true of every line the prompt's read-back exists to catch. So when the model
read its own work back, found that "Led recruitment" was not what the fact said, and returned
"Supported recruitment", the merge called that an accidental drop, restored "Led
recruitment", and the remaining lookup passed it. The self check and the merge were undoing
each other and the merge won. It applied to the summary and the skill order on the same
rule.

**The distinction, and it is the whole of the fix.** Nothing in the code can read whether a
line changed its claim. What the code can see is whether the retry spoke about the line at
all. An answer that names a bullet has decided about it, and writing the resume's own words
back is one of the two things the prompt asks for when a line is not supported. An answer
that never names the bullet has said nothing, and silence is the omission finding 14 is
about.

| The retry | Before | Now |
|---|---|---|
| names a line, new text | stands | stands |
| names a line, the resume's own text | the previous answer's line is put back | stands |
| never names the line | put back if the validator had not objected | unchanged, put back if the validator had not objected |
| names a line the validator objected to | never put back | unchanged, never put back |

Finding 8's reading of what a line is survives untouched: a line is still what the applied
document says it is, and the counts are still taken off the applied document. What is
withdrawn is the conclusion it drew, that any line at the base text should be restored.

**The summary is never restored, and that is a narrowing of finding 8.** The schema makes
every answer write the summary field, so there is no silence to tell apart from a decision: a
retry that returns no summary has returned no summary. The cost is that a model which forgets
its summary loses it. That is the cheaper of the two errors, because the other way round
keeps a summary the model's own read-back had just withdrawn, and it is the case the review
named. Flagged here rather than in a commit message because it reverses part of a finding
that was accepted three days ago.

**The skill order follows the same rule.** An order the retry wrote is an order it chose,
even when it is the base's. Only an answer that gives no order at all has said nothing.

**The prompt is aligned, because it contradicted the rule it was enforcing.** The retry block
told the model that "a line not named below must come back exactly as it is above", while
`RULES` told it that an unsupported line is rewritten or dropped. A model reading both was
told to leave a line alone and to fix it. The retry block now says what returning a line
means, what leaving one out means, and that correcting or reverting a line its own read-back
finds unsupported is the task rather than a way of dropping it. `PROMPT_REVISION` is
`2026-09-19.p5`.

**What p5 costs, labelled for what each number is.** The retry block goes from 225 to 847
characters, which is measured. At four characters a token that is about 156 tokens, which is
an estimate and not a measurement. At USD 0.2 per million input tokens it is about USD
0.000031 per retry, and it is paid on the retry call only, never on a first call: over the 48
retries of the 80 job sample it would have been about USD 0.0015 in all. The output side is
unmeasured, as it is for p4, and gets measured with the first paid run of phase 1.

**"Keep both attempts" is implemented as the merge not destroying either, not as storing
both.** The user chose this when asked. What the retry wrote is still visible only in the
soft finding's sentence and the attempt log, not as stored text, so a person reading a packet
cannot see the first answer's wording of a reverted line. That is a real limit and it is
recorded here rather than left to be discovered: if the packet screen needs to show both, a
column has to be added.

**What this does not claim.** It does not make the self check reliable. D-036 says a model
checking its own output is a soft test and that framing is unchanged. What this fixes is
narrower and worth saying plainly: the system was taking the model's corrections and putting
the errors back.

### D-038. A rejection blocks the document, it does not delete it

The user's call, from the sixth review, and it is first on that review's list because every
other item on it is reversible and this one is not.

Three places cleared a stored resume when a packet was rejected: the run, when the retained
attempt carried a hard finding; a restamp, when the rules as they stand reject a row that
was ready or held; and a revoke, when a row's stored resume is not the base plus its stored
changes. All three now keep the document and its hash on the row. `consumableResume` is
unchanged and is still the one door: it serves a `ready` packet and nothing else, so a kept
document is no more submittable than an absent one.

**What deleting it bought, measured: nothing.** Over the one day the name and posting word
findings were hard, clearing the resume on rejection destroyed ten tailored documents and
caught no fabrication (D-036). The demotion arrived the next day and could promote none of
them, so D-037 had to be written to rebuild seven from their stored change sets, and six
could not be rebuilt at all. Every one of those mechanisms exists to undo a deletion that
answered no question. Keeping the document is cheaper than all of them and it is the only
one that works before the fact.

**What the snapshot says about the six, checked before this was written.** The six packets
still invalid were described as having no artifact anywhere. That is true of two of them and
false of four:

| Packet | In `design/snapshots/2026-09-18-packets` | Finding that rejected it |
|---|---|---|
| 01b8f46b | needs_review, 18 bullets, hash dbdfc737 | posting word, "roadmap" |
| b40e9ede | needs_review, 18 bullets and a summary, hash 968dda58 | posting word, "members" |
| 96e3b4bf | needs_review, 18 bullets, hash 1ad14acd | posting word, "relationships" |
| 433b326a | needs_review, 18 bullets and a summary, hash 1b66028e | name, "KPI" |
| d5684230 | invalid, no resume | `value-not-in-cited`, `num:6` |
| 2e4fdc00 | invalid, no resume | `value-not-in-cited`, `num:6` |

The snapshot was frozen at 12:00 UTC on 18 September and the restamp that cleared those four
ran after it. **Nothing is restored here.** Reading a file is not a recovery, and a document
taken from an external file is not "the base plus the row's own stored change set", which is
the line review five's finding 6 draws and the whole of what made D-037 legitimate.
Restoring them is a separate decision and it is the user's. What is corrected now is the
claim: "no change set" is not "no artifact", and the earlier wording said it was.

**Two judgement calls made rather than asked, recorded here rather than in a commit
message.**

The revoke path keeps its document too. The review's item says "rejecting", and a revoke is a
rejection the validator did not ask for: the row is rejected because nothing can verify what
it stored, not because anything was found in it. The same argument applies unchanged. The
document may be perfectly good and what is missing is the evidence to say so, and deleting it
does not supply the evidence. If the user wants the revoke path to keep deleting, that is one
line.

A rejected row's kept document is not re-verified against the base plus its changes. The
status check comes first, so an invalid row is stamped and its document kept without asking
whether it rebuilds. Nothing promotes an invalid row, so nothing rests on it; the moment
something does, that path has to verify first, and the rebuild branch of D-037 is where it
would go.

**What this does not change.** It does not make a rejected document available to anything. It
does not weaken a finding, move a level, or alter what the validator reads. The status column
means exactly what it meant. The only difference is that the evidence survives the verdict.

### D-037. The seven packets a withdrawn rule destroyed are rebuilt from their own stored change sets, and the six that cannot be are left invalid

The user's call. Ten packets were rejected on 18 September by `name-unknown` and
`posting-word-unknown` while those findings were briefly hard, and a rejected packet loses
its stored resume. D-036 withdrew that level the next day. All ten pass under the rules
that followed, and none could be promoted, because the document was gone. Three more sat
invalid from r6 on a rule D-034 had already deleted.

**Seven of the thirteen store the change set they were built from.** For those, the
tailored document is base plus that change set, and both are on the row, so it is
reproducible exactly and by nothing but arithmetic. Rebuilding it is reconstruction, not
invention.

**The constraint, and it is the whole of the decision.** The candidate is rebuilt from the
base and the stored change set only. It is then read by the validator as it stands today
and stamped with whatever that says. Nothing is promoted by hand: a rebuilt candidate that
passes becomes ready, one that holds holds, one that is rejected stays rejected with no
resume. `replayDecision` gained one branch and `--apply` writes the rebuilt document and
its hash like any other restamp.

**Why this does not break review five's finding 6.** That finding says a row must not be
promoted without a verifiable candidate, and it is the reason a row whose stored resume is
not the base plus its stored changes is revoked rather than trusted. A candidate rebuilt
from its own stored change set is verifiable in the only sense the finding means: the
inputs are on the row, the function is deterministic, and the result is validated again
before anything is stamped. The difference between the seven and the six is the change
set, and that is exactly the line finding 6 draws.

**The six with no stored change set stay invalid.** They were written before change sets
were kept, nothing can reconstruct them, and no rule here invents a document. That is the
cost of a check that deleted the evidence a day before it was demoted, and it is left
visible rather than papered over.

**Applied 19 September 2026 from merged code (f815211).** Before: 82 ready, 12 held, 13
invalid. After: 83 ready, 18 held, 6 invalid. 101 rows written, 7 changed status, 7 rebuilt
from their own stored change sets, 6 left alone.

**Of the seven, one came back ready and six came back held.** The six are held by the very
findings that had rejected them, `name-unknown` and `posting-word-unknown`, which D-036
demoted to review: the same word, the same line, a hold instead of a deletion. The one that
came back ready is an r6 row whose only finding was `value-not-in-cited`, a rule D-034
deleted outright, so nothing was left to say about it.

That is the shape of the whole episode in one line. Seven tailored resumes were destroyed
by findings that, read again a day later, were worth a hold at most and in one case worth
nothing at all.

The six that stay invalid carry `value-not-in-cited` on `num:6` twice, and `name-unknown`
on "KPI" and `posting-word-unknown` on "members", "relationships" and "roadmap" once each.
Every one of those findings is stale, from a rule that is gone or demoted. **None of the
six is invalid for a fabricated value either.** They are invalid because nothing can
rebuild the document, not because anything is wrong with it.

## 18 September 2026

### D-036. A guess never destroys work, the model checks its own lines in the same call, and the real checker is a model that is not built yet

Three decisions taken together, all the user's, closing the phase.

**1. A guess never destroys work.**

`value-unknown` stays hard. A number or an amount that appears nowhere in the user's
confirmed facts is fabrication and not a judgement call: the reader matched a figure, and
a figure either appears on the profile or it does not. Rejecting it is correct, and it
keeps the one retry.

`name-unknown`, `posting-word-unknown` and `qualification-unsupported` become review. The
tailored resume is kept, the finding names the word, and a person decides. The reason is
what the previous day's work disclosed: raising these to hard immediately produced three
families of false positive, all fixed in code (month names, an amount written "$1.1B",
verbs whose past tense ends in neither "ed" nor "ing"), and a fourth that has no fix
because no list of verbs closes it. "Oversight of four managers" is flagged where "Oversaw
four managers" is not. A check built on a word's shape will always have that edge.

**The general rule, now in CLAUDE.md beside the principle: a finding may reject a packet
only when what it found is certain. A finding derived from a guess about a word's shape
holds instead. A new check that cannot say which it is, holds.**

**A held finding earns no retry.** `name-unknown` is not on the actionable list, so a
guess never buys a second paid call either. This was flagged to the user as a choice made
rather than asked, and confirmed: a guess should not buy a second paid call, and the
alternative ends with the model dropping the line to satisfy a check that was wrong in the
first place. The reasoning stays here rather than in a commit message, because the next
person to wonder why a held packet does not retry will look for it in the log.

What it does to the numbers on the 28 known false lines, and this is the honest form of
the count because rejected and held are not the same thing:

| | Rejected | Held | Neither |
|---|---|---|---|
| The 28 of `pairs.test.ts` | 4 | 4 | 20 |
| A second author's 14 | 0 | 0 | 14 |

Four of forty two. That is what the code catches.

**2. The model checks its own work, in the same call.**

`RULES` in `src/server/packet/tailor.ts` now ends with an instruction to read every written
line back against the facts cited for it, confirm each claim is supported, and rewrite or
drop the line before answering. Same call, no second request, `PROMPT_REVISION` p4.

*(Corrected 19 September 2026 by the sixth review: this said "measured on the input side
exactly" and only the character count was measured.)* The sentence is 423 characters, which is
measured, and the changes instruction grows 18.7 percent. About 106 tokens at four characters
each, which is an estimate and not a tokeniser reading. At USD 0.2 per million input tokens
that is about USD 0.0000212 a call, so at most two calls a packet, **about USD 0.0000424 per
packet**, against a tailoring term of USD 0.00076. Two calls is the ceiling rather than the
average, since a packet earns its retry only when the first answer is held or rejected, so the
figure on a one call packet is half of it. About 5.6 percent of the tailoring term and about
1.3 percent of the USD 0.00333 per application figure, both carrying the same labels. It does
not move the cost per packet meaningfully, which is what the user expected, and that
conclusion survives the relabelling.

**The output side is unmeasured.** Saying so rather than leaving it silent: the schema is
closed and the instruction says not to write commentary, so output should not grow, but
that is an expectation and nothing here has tested it. No paid run was made. It gets
measured with the first paid run of phase 1, and until that number exists the cost of this
change is known on the input side only.

**What this is worth, stated plainly: a model checking its own output is a soft test.** It
is weaker than an independent check, because the same weights that wrote the line judge
it, and a model that was willing to move a number is not obviously unwilling to approve
having moved it. It is better than pattern matching over word shapes, because it reads
meaning at all, which no rule here does. It is not verification and must never be
described as verification.

**3. The real checker is a model, not code. Recorded now, built later.**

The user's call. His reasoning as first written here was "code cannot audit a model", and
*(softened 19 September 2026 on the sixth review's last point)* that is stronger than the
evidence carries. What the evidence carries is this: a hand written checker was rewritten five
times across five reviews, and a second author reading the implementation got fourteen of
fourteen false lines past it. That is not proof that no code could do it. It is enough to stop
buying more of this approach, which is the decision being taken. The permanent answer is a
separate model call that reads the confirmed facts and the tailored lines and judges whether
each claim is supported.

It is not built now, for cost. A second call adds roughly USD 0.0004 to 0.0008 per
application. At eight jobs scored per application the current figure is USD 0.00333
against a USD 0.0035 floor, which leaves about USD 0.00017 of room: not enough. It fits
once the phase 1 pre rank brings scored per applied to about seven.

**The sequencing is the decision: the pre rank comes before the checking call.** *(Corrected
19 September 2026. This said "the pre rank pays for the checking call" as settled fact. It is
conditional on two numbers that do not exist.)* At 25 applications and one extraction, seven
scored per applied leaves USD 0.000479 of room: enough for a checker at USD 0.0004 and not for
one at USD 0.0008, which needs about six. The break even is 7.25 scored per applied for the
cheap end and 5.97 for the expensive end. Whether the pre rank pays for the checker depends on
the measured pre rank saving and the measured checker cost, and neither exists. The sequencing
holds regardless, because the pre rank is the only lever on the term that dominates; the
sufficiency does not. The cost summary carries the table.

**And the pre rank must be measured for whether it preserves applications, not only for
whether it reduces scores.** Scored per applied is a ratio. A pre rank that cuts the numerator
by dropping jobs the user would have applied to cuts the denominator with it: the ratio
improves on paper and the product does less. Any measurement of it states what it did to
applications.

Nothing about the checking call is designed here beyond what it is for.

**Until then the hand written check is a placeholder, not the design.** It rejects a
fabricated figure and holds a suspicious word, and that is the whole of what it is meant
to do. Every document that describes it says placeholder.

**What the one day at hard cost, found by the r8 restamp and recorded because it is the
case for this decision.** Ten stored packets were rejected under r7 on 18 September by a
name or a posting word, and a rejected packet loses its stored resume. Under r8 all ten
pass, and none can be promoted, because the resume is gone. The words that destroyed them
were "alignment", "analytics", "cross-team", "execution", "experience", "members",
"professionals", "relationships", "roadmap" and "KPI". Not one is an invented metric,
employer, product or qualification. Three further rows sit invalid from r6 on
`value-not-in-cited`, a rule D-034 deleted, so **not one of the thirteen packets still
marked invalid is invalid for a fabricated value**. Seven of the thirteen carry a stored
change set and could be rebuilt from base plus changes; that is a separate decision and is
not taken here.

This is the argument for the rule in one paragraph. A guess was allowed to reject for a
single day, on one demo profile with 107 packets, and it destroyed ten tailored resumes
and nothing else.

### D-034. The meaning comparison comes out of the validator and the truthfulness instruction moves into the prompt

**The user's decision.** It reverses an architectural choice made in phase 0 and it is not
an engineering trade made in a pull request.

The reason, in the user's words: a prompt telling the model not to invent things is the
guarantee he wants. He does not want the system writing a line and then reading it back to
argue with itself.

**What stays.** A value or an entity that appears nowhere in the user's confirmed facts is
a hard finding. Profile wide, not against the facts the line cites. One lookup, fast, and
it almost never fires wrongly.

**What goes.** Every comparison that establishes what a line means against what a fact
means: the predicate binding and the segment model, the metric subset test, the period and
frequency comparison, `contradiction` over kind, unit, role, direction, relation and
negation, the entity relationship question, and the employer rule. The code is deleted, not
disabled; nothing sits behind a flag. `claims.ts` goes from 453 lines to 190.

**What it buys.** No hold rate and no queue. A simpler system with one rule in it that can
be explained in a sentence. And truthfulness stated where the user wants it stated, in the
instruction to the model, rather than inferred afterwards by code arguing with its own
output.

**What it costs, in the measured numbers rather than in words.** Measured on the code as it
now stands, `npm run probe-cheap-check` against
`design/snapshots/2026-09-18-packets`:

| What | Before | After |
|---|---|---|
| The 80 saved answers: ready / held / invalid | 53 / 25 / 2 | 74 / 0 / 6 |
| Held or invalid | 33.8 percent | 7.5 percent |
| The 28 known false lines of `pairs.test.ts`, rejected | 28 | 8 |
| The reviewer's 14, rejected | 1 | 0 |
| Truthful case 1 lines that pass | 26 of 26 | 26 of 26 |

By case, of the 28: invention 7 of 17 still rejected, case 2 one of 8, case 3 none of 1,
case 4 none of 2.

**Nineteen of twenty eight known false lines stop being caught, and ten of those are plain
inventions.** That last part is the sentence nobody should have to discover for themselves
in six months. A word that appears anywhere on the profile satisfies the remaining check,
so "Built dashboards in Salesforce" on the Excel role passes as long as the user knows
Salesforce somewhere, and "Led recruitment" passes as long as recruitment appears under any
role. Case 0 as a label is not case 0 as a check. The check catches fabrication only when
the fabricated thing appears nowhere on the profile at all, and against a full profile that
is a narrow net.

**There is no evidence that any particular resume is clean.** The validator never provided
much and now provides less. `pairs.test.ts` says so in its own header, and it no longer
asserts that fabrication is caught.

**The findings that remain are hard, not review**, which is the user's rule as written. The
hold rate is therefore zero and the rejection rate is 7.5 percent: six of the 80 answers
carry no tailored resume and the user gets the original. That is a different shape from a
queue of 25 held packets, and it is the shape the user asked for.

**Three judgement calls inside the decision, made rather than asked, each flagged here.**
The claim position scope on the posting rule is kept, because it decides which tokens are
looked up rather than what any of them means, and without it the rule fires on ordinary
rewording (D-023 measured that at eight in ten against one in four). `number-unreadable` is
kept as a held finding, because it says the lookup did not run on a value rather than that
the value is wrong; it fired zero times on the 80. The two citation findings are kept as
held findings for the same reason, and they also fired zero times.

**Raising the findings to hard exposed three false positives** that were harmless while
they were holds. All three are fixed in the code: a month name read as a capitalised word
in no fact, an amount written "$1.1B" read as a name by its form, and verbs whose past
tense ends in neither "ed" nor "ing", of which "Cut" is the one that matters. A fourth is
recorded and not fixed because no list closes it: "Oversight of four managers" is rejected
where "Oversaw four managers" passes.

**What follows from this, decided with it.** `needs_review` stays as a status and DOC-03
stays a gate before submission, because a person should still see what goes out in their
name. It stops being a queue: at 7.5 percent rejected and nothing held, DOC-03 is a normal
review step, not a primary flow staffed as such. The cost summary's held packets section,
its DOC-03 primary flow paragraph and its conversion paragraph move together with this.

**The validator work of the last two days is withdrawn, not deleted quietly.** It is
findable in the history, and it is named here so that nobody in six months wonders where it
went: #36 the normaliser and the unreadable phrase rule, #38 rule 2 and the metric subset
test, #39 and #40 rule 1 and `entities.ts`, #57 the claim model, #58 the entity rules, #64
the retry restoration (kept: it is not a meaning comparison), #66 stable codes (kept), #77
the principle (kept, and re-marked above). D-020, D-021 and D-022 describe rules that no longer exist, and D-023 describes one that
mostly does not; they are left in place, in date order, as the record of what was built and
why, and this entry is what supersedes them. *(Corrected 19 September 2026: D-023 was listed
with the others and its claim position narrowing is still in `entities.ts` and still used by
`checkLine`, which this same entry says three paragraphs above is kept. The entry contradicted
itself and the code was right.)*

### D-035. The rest of review five is placed in phase 1, not done

Seven findings from the fifth review are left undone on purpose, the way D-019 placed the
second review's remainder. None of them is a defect a user meets: every one is about the
measurement apparatus, and the measurement work belongs with phase 1.

- **The snapshot is overwritable and is not a consistent read.** It is a set of files
  anything can replace and its tables are read one after another, not in one transaction.
  It has not been wrong yet, and nothing reads it but a report.
- **The saved answers are not self contained.** A replay needs the snapshot beside them.
  They are only read next to it, so nothing is broken today.
- **The backfill's "exact match" claim overstates what it verified.** A wording defect in a
  report nobody acts on without reading the rows.
- **The citation reports use different populations.** Partly addressed by #66; the
  remainder is that two numbers in the same report still count over different denominators,
  which matters when the numbers are quoted and not otherwise.
- **A repeated replay appends duplicate findings.** Coverage findings stack on a row that
  is replayed twice. The status does not change, so the effect is a longer list.
- **Partial extraction loses data without raising an issue.** Real, and it needs the
  extraction work of phase 1 to fix properly rather than a patch here.
- **The cost attribution labels overclaim.** A label says a cost belongs to a thing it can
  only be associated with. Fix it when the cost function is restated with users in it.

### D-033. The pool hands out live connections, and the wake time is on the record with what it was measured against

Two infrastructure facts from 18 September 2026, both found because the test suite kept
going red and neither of them a test problem.

**The pool kept dead connections and gave them to the next caller.** `src/db/client.ts`
built one process global `Pool` with no error handler and no recycling. When Neon's proxy
dropped a websocket, the client stayed in the pool and was handed to whatever asked next,
which failed with "Client has encountered a connection error and is not queryable". It
showed up as roughly one 30 second hang per test run, on a different file each time,
which is why it read for a while as a defect in whatever had changed last. Three of five
branches that day needed a second run because of it.

The suite is only where it was noticed. That pool is a module global on purpose, so on
Vercel it survives between invocations and a new request borrows a connection an earlier
request opened. A dead client there is a 500 in front of a person, and the request that
pays for it is not the one that broke the connection. A fault that forces a rerun also
makes every measurement taken on that run unreliable, which is most of what this week has
produced.

Two lines, and neither changes how anything connects. An error handler on the pool,
because without a listener an idle client whose socket dies emits "error" on an emitter
nobody is listening to and Node turns that into an uncaught exception; with one, the
client is removed before it can be handed out and the eviction prints
POOL_CLIENT_EVICTED so it is searchable rather than silent. And a four minute client
lifetime, so the pool retires a connection on release before the proxy closes it
underneath us.

Proved the way the check chain was proved, by breaking it on purpose: a client is killed
while idle in the pool, and the pool evicts it, logs it, and gives the next caller a
different connection that works; three consecutive deaths do not stop the pool serving.
With the handler removed the same test fails with the raw error escaping, which is the
production hazard in miniature.

**The wake time, and what it was measured against.** A global test setup wakes the
database once before any test and prints how long it took (#70). The numbers so far, all
on this machine, one project, `npm run check` runs of the full suite:

| Wake | Compute state | Run |
|---|---|---|
| 3024 ms | Free plan, scale to zero on | failed |
| 3852 ms | Launch, minutes after the plan edit | failed |
| 3985 ms | Launch, minutes after the plan edit | failed |
| 742, 747, 724, 876 ms | Warm | passed |

Every run that reported a multi second wake failed and every warm one passed but one.
The 3024 ms on the free plan against 742 to 876 ms warm is a clean before and after, and
that part is settled.

**The multi second wakes after the upgrade are unexplained, and are recorded as
unexplained.** One candidate is that editing a compute restarts it, and scale to zero and
the autoscaling ceiling were changed in one edit, so a run in the following minutes would
show a wake whatever the setting says. That is a plausible account and not a verified one.
The monitoring graph is being read to see whether anything is still suspending the
compute. Until it has been read, a multi second wake is an open question rather than a
leftover from the edit, and writing it down as the restart would be the same move as
calling the 74 versions unrecoverable before anyone looked at the retention window.

The warm up stays either way. A green build should not depend on a billing setting, the
plan can change, and a new environment can start on free.

### D-032. Review five: the deliverable is corrected where it was wrong in public, "addressed" stops meaning "closed", and a restamp is only ever applied from merged code

Review five arrived on 18 September 2026 against the whole review four bundle. It
reproduced failures by running the functions, and it is right that the bundle's summary,
"all nineteen addressed", read as a claim of completeness it could not support. Four of
its claims the user verified before any work started and they are not relitigated: 18A,
18B, finding 6 and finding 16. This entry records the corrections to what is published,
and the rule change. The code items are separate entries as they land.

**The framing, adopted.** Addressed is not closed. A change says what it does and what it
was measured against, and whether that closes a finding is the reviewer's call and not
the author's. No entry from here summarises a set of findings as closed.

**18A, a false claim on the deliverable page, corrected.** The page said the number sits
inside the band at eight scored per applied "only if every attempted packet becomes an
application". False against the page's own table: the 78 of 80 scenario gives USD 0.00335,
inside the band, with two packets not converting. It confused "the only scenario listed
that is inside" with "the only conversion that is inside", and never solved for the
threshold. Solved: at eight scored per applied and 25 applications per user, the total
reaches the low end at 65.7 of 80 attempted packets converting, about 82 percent. At 10
applications per user it is 76.1, about 95 percent. At 5 it is 103 of 80, so no conversion
is enough and eight is over the low end whatever happens. The page carries the table.

**18B, the caveat with the backwards number, withdrawn and replaced by a count.** Covered
in the correction on D-030. The rate comparison is replaced by what became of each
unsupported line: of 39 on the first attempt, 19 corrected, 16 deleted, 3 retained, 1
replaced, 1 new on the retained attempt.

**18C, the tailoring term is historical and the current one is unmeasured.** USD 0.00076
per attempted packet was measured under prompt revision p1 and validator revision r3.
Since then the retry is given the answer it is correcting rather than the findings alone,
a retry's clean dropped lines are put back and the merged set revalidated, and the
validator has moved three revisions. Each of those changes what the model is sent, what it
returns, or how many lines a second attempt writes. Replaying stored answers offline
cannot measure any of it. The figure stays on the page as the last measured one, labelled
with the revisions it was measured under, and the cost per attempted packet under the
policy that ships is unmeasured until an authorised paid run measures it. No such run is
made without asking first.

**18D, extraction is per extraction and not per user.** The product lets a user upload a
replacement resume whenever they want one, so "per user, once" was an assumption dressed
as a unit. The term is now extraction cost times extractions per user over applications
per user, and the tables hold extractions per user at 1, which is the floor.

**18E, conversion is packet to application.** The tailoring denominator is attempted
packets, so the quantity that converts it is the share of all attempted packets that
become applications, not the approval rate among held packets on DOC-03. A ready packet
can fail to be submitted, an invalid one can go out on the original resume, and a held one
can be approved: conversion covers all three routes and the approval rate covers one.

**Finding 17, the chronology, corrected from the snapshot's own timestamps.** The cost
summary dated a restamp to 22:50 UTC on 18 September and the overwrite it preceded by
seven minutes to 22:57 UTC on 17 September, which cannot both be true. The cause is that a
run tag is named for the date in Istanbul and every timestamp is UTC, three hours behind:
the runs tagged `18sep` wrote their cost rows on 17 September UTC. The 27 surviving rows of
that restamp carry `updated_at` of 22:49 and 22:50 UTC on 17 September, so the restamp was
17 September and the cost summary is corrected. The convention is now stated on the page so
the contradiction is not reintroduced.

**The rule change: a restamp is applied from merged code, never from a branch.** Restamps
continue to be applied without asking whenever the rule behind them is merged, always
reported before and after with the rows that moved named. What is new is the condition.
Applying one from an unmerged branch leaves production in a state no committed code can
produce or explain, which is the same defect as a script that has written to the live
database existing only in a working tree, wearing different clothes.

**And the sequencing note that rule exists to make legible.** Validator revision
2026-09-18.r6 was applied to the live packets on 18 September 2026 ahead of its merge. The
rule that produced it, holding a row whose facts hash no profile reproduces or whose
posting has moved, lives on the branch `replay-exclusion`, which was committed but could
not be pushed because the test suite could not run against the database that afternoon.
107 rows were written, 1 changed status, and the table went from 62 ready, 41 held, 4
invalid to 61, 42, 4. The row that moved is the packet whose job text has changed since it
was written. If that branch changes before it lands, this is the record that the live table
ran ahead of it.

### D-031. Review four's last four items: the retry may not delete what it was not asked to, a receipt may not destroy the work, findings are counted by code, and a sample's answers say what made them

The last four items of review four's order, 18 September 2026, one pull request each,
all measured before they shipped and none of them needing a paid call. Phase 0's review
four list is complete with this entry.

**Finding 14, the retry (#64).** The prompt told the model not to drop a line and the
model could not have obeyed: it was sent the findings and never the answer it was
correcting, so it rewrote from the posting and could not see what it was dropping.
Measured over the 45 retries the run kept as the packet: 35 dropped edited lines, 5
edited a different set, 3 reverted to the base resume, 2 kept everything. 171 edited
lines were dropped, 145 of them lines the validator had never objected to. Three
changes: the retry is now shown its previous answer line by line; a dropped line the
validator did not object to is put back, never one it did, with the retry's text winning
where both edited the same line and the merged set validated whole; and what the retry
did is classified and recorded on the attempt log and as a soft finding. The status
delta on the saved answers is zero, 22 ready, 21 held, 2 invalid before and after, and
that is the result rather than a disappointment: 145 tailored lines across 42 of 45
packets stop being deleted, and putting them back fires no new finding, which is also
the check that the merge is sound. The prompt half cannot be measured without a paid
run and is not claimed to be.

**Finding 16, the cost worksheet (#65).** Five inserts were awaited bare, and each could
end the work it was recording. On the success paths a failed insert threw out of the
run, so a paid, validated, ready resume was thrown away over its receipt and extraction
lost facts it had already read, with no cost row written either: the spend lost twice.
On the error paths it replaced the original error with its own, so a packet was marked
failed with "insert failed" rather than the timeout that happened, and in extraction the
throw jumped over the call that marks the document failed, leaving it processing for
ever. recordCost attempts the write and never throws, printing COST_NOT_RECORDED with
the kind, reference and amount so the gap is reconstructable. Stated in the module
rather than assumed: it cannot rescue an insert that fails at the database inside an
enclosing transaction, because Postgres fails every statement after it.

**Finding 17, counting by code (#66).** Reports matched findings by their prose, and that
coupling had already failed twice in one day, silently both times. Every finding now
carries a code from a closed typed list; the message is free to change because nothing
counts it; a row written before codes existed reads its code from its message through one
table used only for those rows, and an unrecognised message reads as no code rather than
as the wrong one. The wrong citation metric was wrong in three ways and not merely
coarse: it counted one hard finding and called it the whole, it divided findings on any
bullet including the summary by cited entries of changes which never contains one, and
it never said which attempt the packets were. It is now four kinds, numeric support,
unsupported responsibility, missing citation and wrong role, all over cited bullet edits,
with an unrecognised column so it can never read zero for the reason it just did.

**The r5 restamp, applied.** Adding codes changes what a stored finding carries, so the
packets were restamped under revision 2026-09-18.r5: 107 restamped, 0 changed status, 0
revoked, 0 stale, the grid diagonal. The table stays 62 ready, 41 held, 4 invalid. The
metric then read, per 100 cited bullet edits, families-18sep 2.08 of 240 cited edits,
sample-2026-09-17 8.28 of 145, and the single product packet 1 of 6, a denominator too
small to mean anything. The old metric would have reported 4 unsupported lines across
all three runs. There are 18.

**First attempt against retained, and what it hides.** On the 80 saved answers, all 80
comparable: 39 of 394 cited lines unsupported on the first attempt, 9.90 per 100, against
5 of 240 on the retained one, 2.08.

*(Corrected by review five, 18B. This paragraph went on to say "the retained attempt has
154 fewer cited lines, 39 percent of them", and offered that as what the fall in the rate
was made of. It is arithmetically backwards. A smaller denominator raises a rate when the
numerator holds: those same 39 unsupported lines over 240 cited lines would be 16.25 per
100, above the first attempt's 9.90. The whole fall came from the numerator. The instinct,
to say what a favourable number was hiding, was right and is the habit to keep; the number
put forward as the answer was wrong and had not been checked before it was published
twice. What the denominator hides is the deletions, and deletions have to be counted, not
inferred from a rate.)*

Counted, on the same 80 answers: of the 39 lines the first attempt left unsupported, 19
were corrected, 16 were deleted, 3 kept the same unsupported claim and 1 was replaced by a
different one, with 1 further line unsupported on the retained attempt that was not on the
first. So the retry corrects about half of what it is sent back for and deletes about two
fifths, and the deletion is what finding 14's merge stops. The cost summary carries the
table; `npm run reconcile-sample` prints it.

**Finding 18, the saved answers (#67).** They are the only copy of work that has been
paid for, and they were written once, after every job finished, so a crash at job 79 of
80 left nothing at all: the same way the 74 versions were lost on 17 September. They are
now rewritten after each outcome through a temporary file and a rename, so the file on
disk is always whole and a run that dies keeps what it finished. They also carried no
provenance, which is exactly why D-029 could not reconstruct the seven runs of 18
September. The header now carries the run, the time, the model, the prompt and validator
revisions, the facts hash and the base resume with its hash, and reading checks the
profile and the base resume rather than assuming them. A file from before headers reads
as unknown, never guessed. PROMPT_REVISION joins VALIDATOR_REVISION at 2026-09-18.p2.

**The four checks are a command (#62), and it caught two of my own defects the same day.**
npm run check refuses a tree that is not clean, which includes untracked files, so the
result describes a commit; it reads exit codes and nothing else, with nothing piped; and
it stops at the first failure, printing the rest as not run. Its own proof run exited 1
for the wrong reason, an unquoted git format string, which is the defect it exists to
stop trusting. It later stopped at tsc on a type error in a test helper after vitest had
passed 17 of 17 on the same file, because vitest does not typecheck.

**What is left of phase 0.** Review four's list is complete. What stays open is what
D-028 and D-029 already named and no code closes: scored per applied is unmeasured and
is the only term that decides the answer, and it needs users. The deferrals sit where
D-019 placed them. Phase 0 closes again when the user says the list is done, and phase 1
opens on the user's word only.

### D-030. The stored packets are restamped and now say what the rules say; the 74 replaced versions are unrecoverable, verified; the validator's miss rate is measured for the first time

> **Corrected twice on 18 September 2026, and the recovery paragraph is worth reading as a whole rather than as its conclusion.** It first declared the 74 versions unrecoverable and the matter closed. Review five was right that nothing established this: the retention window had not been read. It was rewritten as absent from what is on hand with recovery availability unverified. The user then read the console, and the answer is that the window was 6 hours and had expired: the rows are unrecoverable after all. The conclusion did not move. The evidence under it arrived two revisions later, and for a while the entry asserted something nobody had checked. That is the thing to notice, not the fact that the guess was lucky. The other correction, to a caveat about the citation rate that was quoted approvingly and had a backwards number in it, is below and marked.

The second half of 18 September 2026, working review four's fifth and sixth items. D-029 stands; this entry records what changed under it, what was measured rather than predicted, and what is closed for good.

**A packet now stores the attempt it kept, whole (#61).** A packet stored its bullet changes and its finished resume, so a replay rebuilt a candidate from the changes plus the stored summary and revalidated that. It now stores the retained attempt's complete change set, summary, cited facts, bullet edits and skill order; which attempt it is, 1 based, because the retained attempt is not always the last; and the validator revision it was stamped under, so a status says which rules it passed. Migration 0013 adds the three columns, additive and nullable. The posting revision stamped on a packet is now the one the model was given: it was read a second time from the jobs row at store time, so a packet that ingestion touched between the two reads was stamped with the revision of a posting nobody had tailored against.

**The backfill, and the two populations it creates.** `npm run backfill-change-sets -- --apply` wrote the change set and the attempt number on the 80 families-18sep rows from the frozen saved answers, writing only where the rebuilt document matched the stored one exactly: 80 verified, 80 written, 0 differ. The 27 legacy rows have no saved answers and keep a null change set. So the table now holds two kinds of row, and every report says which: 80 replayed whole, and 27 whose bullets can be replayed and whose summary cannot. A legacy row with a summary can no longer be stamped ready by a replay. It is held with "summary not revalidated", because ready on a document half of which nothing read is the claim the status column is not allowed to make. A legacy row with no summary is fully covered.

**The restamp, applied, with the numbers it produced and not the ones predicted.** D-017 says the status column means "passes the rules as they stand", so a rule change is followed by a restamp or the column asserts something the validator would not agree with. `npm run validator-report -- --apply` ran on the afternoon of 18 September over all 107 packets: 107 restamped, 6 changed status, 0 revoked, 0 refused as stale. The table before and after, both read from the database:

| Stored packets, 107, two profiles | Ready | Held | Invalid |
|---|---|---|---|
| Before the restamp, as the families-18sep write left them | 68 | 35 | 4 |
| After the restamp, under the rules as they stand | 62 | 41 | 4 |

The 6 that moved are all ready to held: 5 legacy rows whose summary cannot be revalidated, and 1, packet ea70de4d, on the entity rule of #58, "present targets and performance to the board" where the cited fact presents targets. Nothing was revoked, which is its own result: all 103 stored resumes rebuild from their base and their stored changes, and `resume_hash` names the stored document on all 103. Every row now carries the validator revision it passed under, `2026-09-18.r4`. This is not a held rate and is not combined with one: it is the state of a table holding two profiles, 80 packets on the uploaded resume and 27 on the seeded facts. The rate of record stays in the cost summary, whose stored packets line is corrected in place with this entry as the reason.

**The validator's miss rate, measured for the first time.** *(Corrected the same day by review five. What follows is what this entry said; the correction is the paragraph after it, and the original is kept because the way it was worded is the mistake worth seeing.)* Every number this project has produced counted how often the validator fired. `src/server/packet/pairs.test.ts` counts the other direction: 28 deliberately false lines the validator must catch, 26 truthful lines built from the same facts that it must let through, run on every `npm test`. It catches 28 of 28 and passes 26 of 26. Its limit is the whole of its weight, and is written beside it every time: the set is small and one author wrote both the rules and the examples, so it shows the rules do what that author meant, and it cannot show what nobody thought to write down. It is not the diverse labelled set review four asked for. A zero is a floor under the rules as they stand, not evidence of correctness on real resumes.

**The limit above cashed out within a day, and the entry was still wrong to lead with the zero.** Review five's author read the implementation and wrote 14 false lines against it. The validator missed all 14, on 18 September 2026, before any of the fixes that followed: three where a value borrows a neighbouring claim's meaning, two where a period migrates to another activity, two on date shortcuts and counts read as years, five where the entity check reads vocabulary but not the relationship, and two on lowercase tools and borrowed certifications. Every one was reproduced here against the real validator before anything was changed.

The 28 of 28 is not withdrawn and was not wrong: it measures that the rules do what their author meant on the cases their author thought of, and it is a real regression floor. What was wrong was the shape of the sentence. "A miss rate of 0" was the headline and the limit was the qualifier, when the limit was the finding. **The only miss rate measured against an author who did not write the rules is 14 of 14 missed.** A set written after reading the implementation measures coverage of that set. Nothing measured so far measures the general rate, and the next independent set will say something about these fixes and nothing about the ones after them, which is why `pairs.test.ts` now marks each case with who wrote it.

One of the 14 deserves naming on its own, because reproducing it made it stranger than reported. The normaliser reads three dash characters three ways: a hyphen minus keeps the sign, a figure dash is left unread and therefore held, and an **en dash is dropped, so "-11 percent growth" becomes "11 percent growth" and a loss is published as a gain.** A resume pasted out of a word processor is exactly where an en dash comes from. Whatever the rule becomes, it wants a test per dash character and not one test for "a negative number".

**Three defects of mine in the validator report, one class (#61).** A filter that finds nothing reads as a zero. The "ready today" counters and the held reasons table both read the outcome label, which had gained ", bullets only", so every bullets only row fell out of them: the held count printed 1 where the true number is 6, and the reasons table described 25 of the 41 held packets. Both now count from the decision's status. The review reasons table ended in a fallback branch, so every reason added after it was written, the three entity rules of #58 and the new coverage finding, was counted as "metric unreadable"; every message is now named and an unnamed one prints itself as unclassified rather than joining a real bucket. The class is worth naming because it is silent: none of the three ever threw, and each produced a plausible smaller number.

**The four checks are a command, not a habit (#62).** Two failures in two days came from the chain and not from the code: an exit code cut a push chain and half a pull request merged, and a chain read output instead of exit codes and let a commit in with a failing test. `npm run check` runs the four on the committed tree. It refuses a tree that is not clean, which includes untracked files, so the result describes a commit; it spawns each step and reads only its exit status, with nothing piped and a signal counted as a failure; and it stops at the first non zero, printing the rest as "not run" and exiting with that code. Both properties were proved before it merged, the gate on an untracked script and the stop on a deliberately failing test, and the proof caught a defect in the checker itself: its first run exited 1 for its own reason, an unquoted git format string, while looking exactly like the refusal it was meant to demonstrate.

**The 74 replaced versions are unrecoverable, and this is now verified rather than assumed.**

The user read the Neon console on 18 September 2026. The project's history retention window was **6 hours**. The overwrite ran between 22:57:07 and 22:58:20 UTC on 17 September, about 17 hours before the console was read, so the window had expired well before anyone looked and the point to restore to, 22:57:00 UTC on 17 September, was already out of reach. Point in time recovery cannot return those rows. No restore, branch or recovery was attempted at any point.

What is lost: the packets the six earlier runs produced before families-18sep overwrote them, and with them any way to check the two retry runs and the four narrow runs against their own rows. They are absent from the current table and from every export on hand, including `design/snapshots/2026-09-18-packets/`, which states what is missing rather than reconstructing it.

*(How this paragraph got here matters more than where it ended up. It first said "unrecoverable, closed" on 18 September, reasoning from a missing console session and a provider's documented default. Review five was right to refuse that: an assumption about a default is not a reading of a setting, and the paragraph was rewritten to say the rows were absent from what is on hand with availability unverified. The console then confirmed the original conclusion. The conclusion was lucky, and the method was still wrong. A guess that turns out right is not evidence, and the only reason anyone knows now is that somebody with access looked.)*

**The window is now 7 days.** The project has since moved to Launch, scale to zero is off and history retention is raised from 6 hours to 7 days. The same mistake, an overwrite nobody notices immediately, now costs a week of grace instead of six hours. That is the change that makes this recoverable next time, not any discipline in the code.

**Phase 0 stays open.** The reviewer's order has four items left, one pull request each: the retry that drops edited lines must classify what it did and keep the first answer's clean lines (14); a cost row insert failure must not abort tailoring or extraction nor swallow the original error (16); findings need stable codes and the wrong citation metric needs splitting into kinds with the same unit above and below the line (17); saved answers must carry the facts hash, base resume, model, prompt and validator revisions and run id, written as each outcome lands (18). Then phase 0 closes again. Nothing from phase 1 is touched, and phase 1 opens on the user's word only. All four were done the same day; D-031 records them and what they measured.

### D-029. Phase 0 is reopened: the sample script stored what it was told not to store, the population is frozen, the tailoring term is a cost per attempted packet, and the number is a band

Review four, 18 items, 18 September 2026. Three findings the user verified against the code before the review was worked and which are not relitigated: 1, replay leaves an unverifiable ready packet ready; 12, `--no-store` followed by another flag read as store true; 7's `MONTHS`, the prototype membership bug fixed in the normaliser and left one file away in `claims.ts`. This entry records what finding 12 did to the data, what was done before any code changed, and what finding 19 does to the phase 0 deliverable. The fixes follow in the reviewer's order, one pull request each.

**What finding 12 did.** `arg()` returned the token after a flag, so a boolean flag followed by any other flag read as that flag's name. The 80 job cross family sample of D-024, run tag families-18sep, was run with `--no-store` before `--save`, and stored its 80 packets at 22:57 UTC on 17 September, 01:57 on 18 September in Istanbul. The upsert replaces the whole row, run tag included, and there is no history table: 74 of the 101 packets stored on 17 September were replaced by fresh answers on the uploaded profile and 6 rows were added, so the table holds 107 packets on two profiles, 80 on the uploaded resume's 40 facts and 27 on the seeded facts. No command line of the seven runs of 18 September is on record anywhere; the line D-022 quotes lacks the `--tag` its run names prove it had. The two retry runs and the four narrow runs cannot be checked: all 20 of their Ashby jobs are among the 80, and every one of those rows was written last by families-18sep. The D-023 restamp ran at 22:50 UTC, seven minutes before the overwrite, on the 101 rows it meant to; its figures stand as a dated observation and are not combined with anything after it.

**Recovery, checked and not performed.** The overwrite is bounded to 22:57:07 to 22:58:20 UTC on 17 September; the point to restore to is 22:57:00 UTC. Neon's history retention for this project and its available restore points were not verified: the Neon console has no session in the browser pane and no API key is on this machine, and signing in is the user's action. Neon's documented default on its free plan is hours, not days, so the window may have closed before this session began; on a paid plan it is a week or more. The 74 replaced versions are absent from the table and from every export before the snapshot below; point in time recovery is the only place they could exist, and no recovery, branch or restore was performed. The user checks the console and decides.

**The snapshot, before any restamp or measurement.** `npm run snapshot-packets` (#52) froze the population to `design/snapshots/2026-09-18-packets/`: every packet, cost, fact, document, user, job, source and match row; the two fact sets the packets were built on, rebuilt from their rows and checked by facts hash, both reproducing exactly; the 80 job sample's saved answers with every attempt's change set; a manifest with the sha256 of each file; and a list of what is absent, stated rather than reconstructed: the PDF bytes, the 74 versions, the command lines, the run's code revision, and one packet whose posting has changed since. Read only. Verified by reading every file back against counts read from the database by their own queries.

**The fix.** Typed flags, `src/lib/cli.ts` (#53): a boolean flag reads the same in every position, an unknown flag or a missing value is refused, `--n` and `--only` are validated, and every sample script prints its parsed flags before it runs. No paid measurement ran between the finding and the merge, and none runs on the old parser again.

**Reconciliation, from the snapshot alone (#54).** Review finding 13 said the scope table in `tailor-sample` read the last attempt and the packet keeps the retained one. Measured packet by packet: the retained attempt re-read under the rules as they stand gives 54 ready, 24 held, 2 invalid, the stored statuses exactly on all 80, so nothing drifted between the run and now; the last attempt gives 54, 21, 5, and the three packets that differ are exactly the three whose held first answer was kept over a rejected retry. Finding 13 explains all of the difference. Two corrections to the first reading of the rows: a packet is unchanged only when its stored document equals the base resume with the summary and the skill order, and by that test 13 of the 78 packets with a resume are unchanged, all ready, not the 24 with zero bullet edits, 13 of which changed the summary or the skill order only; and the six ready packets on attempt two with no bullet edits do not by themselves show the retry deleting. The pairs do: of 48 retries, 2 substituted and kept every edited line as the prompt asks, 2 reverted to the base resume, 7 edited a different set of lines, and 37 dropped edited lines, most of them all but one. The prompt says never drop a line and nothing enforces it; that is finding 14 on live data and it is fixed in its turn. Spend: the 128 cost rows tie one to one to the attempts and sum to each packet's USD and the saved answer's, so the recorded spend and its attribution to attempts are verified; completeness against the provider's bill is not established by our own rows and is not claimed.

**Finding 19, the one that changes the deliverable.** USD 0.0610 over 80 is the cost per attempted packet. It became a cost per application by assuming every attempted packet becomes an application, and about three in ten are held for a person who may never approve them. The terms are now named for what they are: scoring is per job scored, tailoring is per attempted packet, extraction is per user. Converting attempted packets to applications needs the held packet approval rate, which is unmeasured and cannot be measured without DOC-03 and users, so the summary gives the band across the reviewer's scenarios rather than one number: every attempted packet applied, USD 0.00076 per application; every packet with a document, ready or held, 0.00078; ready packets only, 0.00113. The quantity is renamed the upstream model cost per application; submission, the inbox, the agents and infrastructure are not in it, and at this headroom that is not pedantry: under the published formula eight scored per applied left USD 0.000168 under the band's low end, and the ready only denominator is worth more than that. Twenty five applications per user is a scenario, not the worst case for extraction; the summary shows 10 and 5 as well. And the 30 percent held rate is a workflow outcome, not a validator accuracy measure: a lower rate can mean fewer false positives or more missed inventions, and nothing measured so far can tell which, because every number this project has produced counts how often the validator fired and none counts how often it should have fired and did not. That measurement, an evaluation set with deliberately unsupported examples and a miss rate, is on the list.

**Two dated observations, kept apart.** The 101 packet result of 17 September, restamped 18 September at 22:50 UTC: 65 ready, 29 held, 7 invalid, one seeded resume. The 107 packet population of 18 September: 68 ready, 35 held, 4 invalid, on two profiles, which is not a rate and is not combined with any other. The cost summary's stored packets line is corrected in place with this entry as the reason.

**D-028 is reopened.** Phase 0 cannot close on a deliverable whose headline term had an unstated denominator. It closes again when the cost summary states the band as above and the reviewer's order is worked: the CLI flags (done), replay failing closed, the claim and entity gaps with paired truthful and false fixtures and a miss rate, replacement eligibility, partial extraction and the stale editor, the complete selected candidate with immutable inputs and attempt identity, then the reports and this restatement. Phase 1 stays closed until the user opens it.

## 17 September 2026

### D-028. Phase 0 is closed

Phase 0 opened to produce one number, the measured cost per application against the USD 0.0035 to 0.0064 band (D-002). It produced it: cost per application = scored per applied x 0.000311 + 0.00076 + 0.0021 / applications per user, three terms measured on gpt-5.6-luna, stated once in `design/docs/07-Phase-0-Cost-Summary.md`. Across two external reviews and 30 findings, the closeout on 17 September 2026 and the reopening that ran to 18 September, the number moved by 0.06 of a job in the favourable direction: the break even against the band's low end went from 8.48 to 8.54 scored per applied, and "at or below about eight" is the answer it was on the day the phase closed the first time. That is the sentence to reach for in six months.

What the reviews changed was not the number but what stands behind it. The retry that could promote a rejected answer is gone, each attempt owns its candidate, the client never retries and every call carries a timeout, a call of unknown cost is counted as unknown rather than free, a replacement is bound to what the page displayed, every fact is shown whole before it is confirmed, the validator reads claims rather than numbers, a held packet cannot be consumed, a stored packet is restamped whenever a rule changes and the replay that restamps it was itself corrected, word numbers compose along the grammar, a value reads its own predicate, an entity or a responsibility the facts do not give is held while a rewording is not, the held rate lives in one place and is quoted with its limit, the sample draw spans families and keeps its answers, and extraction stores its facts and its ready state together. The tailoring term was restated under those rules from an 80 job cross family sample and came back under the figure it replaced.

What phase 0 does not cover, said plainly. Scored per applied, the ratio of jobs a user is shown a score for to applications made, is still unmeasured, and it is still the only term that decides the answer: at eight the number sits inside the band, at nine it is over the low end, at twenty scoring alone is over it. Tailoring and extraction together are under USD 0.0009 at any ratio and cannot move it. Measuring that ratio needs users, and the phase 1 pre rank is the only work that moves it. Beside that: the held rate is about three in ten on fresh answers, one user, one profile, one draw, a product fact that makes DOC-03 a primary flow and is unknown on a real population in either direction; the deferrals stand where D-019 placed them, incomplete inventories, the SmartRecruiters body behind a 304, rescore eligibility, the parser cases, the rest of the sample manifest, then the freshness work as one item, then boilerplate and date precision; and twelve of the 101 stored packets changed nothing, an open quality question.

Phase 1 is not open by this entry. It opens separately.

### D-027. Extraction stores its facts and its ready state together, and a fact waits with its document on every path

Closing list item 4, review three finding 7. Extraction inserted the facts and then set the document ready in two writes, so a function that died between them left the facts stored under a document still processing or failed: Confirm all refused that document (#32), but a single confirm, reject or edit never looked at the document, and the page offered them. Now the model call stays outside a transaction and the two stores are one transaction, so the facts land with the ready state or not at all, and a failure between them fails the document with the reason and stores nothing. A single confirm or reject moves only a fact whose document is ready or which has no document, the rest are reported as skipped; an edit on such a fact is refused as not ready with the document's state in the message. The page disables Confirm all, Edit, Reject and Confirm on a document that is not ready and says why under its heading. A test injects the failure between the two stores and checks the document is failed with no facts; the decision tests check a processing document's facts are skipped and refused while a user entered fact still moves.

### D-026. Every kind the editor offers has a schema, and a skill edit keeps the evidence it does not mention

Closing list item 3, review three finding 6. Extraction writes contact and link facts, the review page offered Edit on them, and `FACT_SCHEMAS` had neither, so saving one threw. Contact, link and project now have schemas: a contact is name, email and location as written with at least one present; a link is the URL as written, scheme not required, because resumes print "linkedin.com/in/jack"; a project is a name with optional lines, offered by the editor though extraction does not produce it yet. An edit on a kind with no schema is refused with a message, never thrown. A skill's `data.evidence` is the resume's own words for the skill, read by the scorer and the tailored resume; the form showed name and years only and saving replaced the whole object, so editing the years erased it. The form now shows the evidence line, labelled with what reads it, and an edit that does not mention it keeps it; naming it changes it.

### D-025. Bulk confirmation is always bound to what the page displayed

Closing list item 2, review three finding 5. `{ replaceWith }` alone was accepted by the schema and the helper checked the displayed facts only when `seen` was present, so a caller could confirm a document's current waiting facts without saying which facts a person reviewed, the same weakness the versioned single decisions had closed (D-017's predecessor, #33). `seen` is now required by the schema and by `replaceWithDocument`; a replacement whose waiting facts differ from the list shown, in ids or versions, is refused as changed, and an empty list on a document with waiting facts is refused the same way. The page already sent it. No trusted internal caller existed, so no separate unbound operation is kept.

### D-024. The cost per application restated with the tailoring term measured under the rules that ship; the sample draw spans families and its answers are kept; the lexicon stays retired with a trigger; the summary keeps the openers

**Item 1 of the closing list, the phase 0 deliverable gone out of date by work we ordered.** The published tailoring term, USD 0.00078 per packet, was measured under the cited value rule. Rules 1 and 2 and the retry (D-021, D-022, D-023) replaced that rule, so the function and the band table described a rule that no longer existed. Restated from one sample: 80 jobs on 18 September 2026, changes mode, cost rows only, no packets stored, drawn by the fixed draw below across greenhouse 35, ashby 28, lever 13 and gem 4, the same four families in the same order of weight as the phase 0 tailoring sample (greenhouse 46, ashby 40, lever 10, gem 4); 128 calls, USD 0.0610 in all, USD 0.00076 per packet as the sample's total over its 80; 54 ready, 24 held, 2 invalid. The function is now scored per applied x 0.000311 + 0.00076 + 0.0021 / applications per user. The band table is recomputed on the page. The break even against the band's low end moves from 8.48 to 8.54 scored per applied, by 0.06 of a job in the favourable direction: the headline, at or below about eight, stands, and at nine the total is over the low end by 4 percent rather than 5. Limits beside the term: one user, one profile, one draw, and a tailoring term is fixed per application, so this restatement cannot move the answer the way the scoring ratio can.

**The draw, review three finding 17 in part.** `stratifiedSample` sorted its cells alphabetically and took one job per cell per round, so every 20 job draw was the first 20 cells, Ashby's, and with the fixed seed the same 20 jobs each time: the six fresh runs of 18 September before this entry were six generations over one set of 20 jobs. Cells now rotate families, the i-th cell of each family in turn; candidates are read in id order; the draw prints the chosen jobs by family; and `tailor-sample --save` writes every answer's change sets and posting lemmas to a file, so a rule variant is re-read on the same answers with no call. That file exists for the 80 job sample. It changes what finding 17 still costs when phase 1 reaches it: a run's jobs are already on record as the distinct jobs of its cost rows by run tag, the draw is now reproducible and cross family, and what remains is the manifest as a table and the report by stratum.

**Question 1, the lexicon against the narrowed posting signal.** The case: "built dashboards using salesforce data", a lowercase tool the posting uses, outside any claim position; form and capital do not fire and it passes. Measured on the 80 saved answers: the lexicon's only words present were "KPI" twice, which form catches; no lowercase tool name occurred in any line; the model writes tool names capitalised. A tool preposition variant, a posting noun after "using", "via", "in", "with" or "on", fired on nothing but "experience". The lexicon stays retired on that evidence, with its trigger: the first lowercase tool name the posting uses, outside a claim position, in any sample brings it back. Form and capital are not narrowed and fire anywhere.

**Question 2, the summary.** A summary is nothing but claims, the first thing a person reads, and the one line the stored packets cannot replay (D-016). Four rules measured on the same 80 saved answers, no call:

| Summary rule, final answers of 80 | Ready | Held | Invalid |
|---|---|---|---|
| A, shipped: openers ("experience in", "experienced in", "expertise in", "skilled in") and the third person voice | 54 | 21 | 5 |
| B, every posting noun in the summary | 21 | 54 | 5 |
| C, openers plus "with", "across", "in", "of" in the summary only | 36 | 39 | 5 |
| D, every posting noun with "experience" and "leader" exempt | 38 | 37 | 5 |

B and C fire on the frame, "experience" 41 and "leader" 28, the standard opening of a summary, and were rejected for the reason that killed rule 1's first design. D, the frame words exempted as a closed set, still holds 16 packets beyond A on operations 4, execution 4, analytics 2, technology 2 and thirteen words once each: capabilities, evidence, problem, adoption, trust, measurement, hands-on, automation, services, workflows, rhythm, thinker, and three verbs the noun test misses, improves, partners, turns. Those are industry and domain descriptors, "financial services", "technology and telecom businesses", "cross-functional execution", with three or four generic claims among them. Sixteen packets of 80 for three or four generic claims is not close to A, so A stays. The summary is logged as the least visible line, with this measurement beside it so it is not repeated: the openers and the third person voice catch the summary's claims that have a verb, and a summary written as a noun list without one passes on its posting words. D's exemption list is the kind of list this project retires; it was tested rather than argued, and it lost on the number.

**The closing list after this entry:** `seen` required on bulk confirmation; the missing fact edit schemas, contact, link, project, and skill evidence preserved; extraction atomicity with document eligibility on the single confirm path as well as the bulk one. One pull request each, in that order. Nothing else is added.

### D-023. A posting noun is held only in a claim position; the live held rate is the fresh one, about one in four; the tailoring term is back under the published figure; the sample population blocks the cost function

The fresh samples under D-022 held 15 of 20 and 13 of 20, and the posting word alone held 8 of 13. A validator that holds the model's normal output is not a safety net, it is the pipeline, and the signal doing the holding was the one already suspected of firing on tailoring working as intended: the posting's vocabulary used in a rewording. So the narrowing logged in D-022 became the next work.

**The rule.** A posting noun is held only where it stands in a claim position: inside the object of a responsibility or creation verb, "set up feedback loops" claims loops, or after a summary claim opener, "experience in", "experienced in", "expertise in", "skilled in", which is the summary's verb. Third person forms count, "who builds operating systems, develops teams"; the particle after a verb is skipped, "set up". Outside a claim position the posting's word passes, "with attention to detail", "partnering with senior leaders". The form, capital and sentence start signals are not narrowed and fire anywhere, because form and capitalisation are what catch most real tool names. The object rule is unchanged.

**Measured on fresh generation**, four 20 job runs, changes mode, no packets stored, the narrowed rule driving the retry loop and every answer re-read under both scopes so the before and after are the same answers. One user, the current uploaded profile. **Corrected on 18 September (D-024): the seed is fixed and the old draw took the same 20 cells every time, so these four runs, and the two retry runs under D-022, were six generations over the same 20 Ashby jobs, not 120 jobs.** The decisions they drove stand, the narrowing released vocabulary and no entity on any reading, but the figures were narrower than they read, and the cross family figure in D-024 replaces them.

| Final answers, four generations over the same 20 jobs, 80 packets | Ready | Held | Invalid |
|---|---|---|---|
| Posting noun anywhere, the D-022 rule | 14 | 64 | 2 |
| Posting noun in claim position | 58 | 20 | 2 |

Eight in ten to one in four on the same answers. Released, by word: "experience" 38 and "leader" 29, the summary's frame; then operations, execution, partners, turns, stories, improves, guides, develops, automation, feedback, workflows, analytics, issue resolution, trust, mechanisms, governance, once or twice each. No tool, employer, qualification or number among them; that was the test, and it passed. Four are generic claims in summaries whose verb is not on the responsibility list, "improving workflows", "analytics leader", "issue resolution", "governance"; the summary rule is not settled by this entry, see below. The retry under the narrowed rule: held first answers came back ready 8 of 9 and 6 of 11; rejected first answers 2 of 5 and 1 of 6, the rest held, none invalid. The stored packets, replayed and restamped: 37 held to 29.

**The live held rate is the fresh one.** In a sentence about what Jobluvo does, the held rate is about one in four. The stored packets' figure describes history. Both live in the cost summary, and the fresh one is the one quoted.

**The tailoring term.** Retry inclusive, on the four samples: USD 0.00070 to 0.00077 per packet, each sample's total over its 20, against USD 0.00078 published. The narrowing put the term back under the published figure, so item 1 of the closing list may be a confirmation rather than a revision. It is not computed yet, because of the population.

**The sample population blocks the cost function.** Every fresh sample so far fell entirely in Ashby, finding 17 arriving for the fourth time in a number being acted on. That is the draw: `stratifiedSample` sorts its cells alphabetically and takes one job per cell per round, so a 20 job draw over 67 cells is the first 20 cells, and those are Ashby's. The phase 0 tailoring term came from a stratified sample across families; replacing it with an Ashby only term would mix populations inside one published number. So item 1 is computed only from a sample that spans the families the phase 0 sample did, or it states Ashby only and not comparable. The draw is fixed first.

**Open from this entry.** The lexicon was retired against the broad posting signal; that justification has to be redone against the narrowed one, with a lowercase tool outside a claim position as the case. The summary as entirely claim position is measured on saved samples before the summary rule is settled; the openers are not the final answer.

### D-022. The non numeric check holds a new entity, posting noun or responsibility and passes a rewording; the lexicon did not ship; a held answer earns one retry that substitutes; the held rate is a product fact and DOC-03 is a primary flow

Review three finding 3, and the second design of rule 1. The first design held every content word not in a cited fact and measured 67 of 90 ready packets held: it measured rewording as a category, and tailoring is rewording. Withdrawn before it shipped on that number. The reviewer's examples, "salesforce" in lower case, "C++", "recruitment of analysts", are none of them rewordings; each asserts a new entity, qualification or responsibility. That is the line.

**The rules**, `src/server/packet/entities.ts`. A token asserts something new when one of four signals says so: its form, an internal capital, all caps, punctuation inside, letters with digits; a capital in the middle of a sentence; the first word of a sentence when it is not a verb the resume style uses and does not end in "ed" or "ing"; or it is a noun shaped word the job posting uses and the profile does not, the model reaching into the job description. Those four are checked against the whole profile: an entity the user owns anywhere is theirs to place, even as the object of a verb. The fifth signal is the head noun of the object of a responsibility or creation verb, "Led recruitment of analysts" claims recruitment, and it is checked against the facts the line cites, the same principle as the employer rule: a responsibility is bound to the fact it claims to come from, and "managed analysts" with the analysts borrowed from another role is the employer lie in another shape. Objects that name no domain, "present progress", are exempt. Noun shape is read from the ending plus a closed class of light verbs and plain adjectives, "use", "needs", "clear", "complex", the same kind of list as the function words; a posting cannot add to it. Every finding is review and names the token, and an object finding names the word the cited fact uses in its place, matched on the same verb first: "analysis, the cited fact says study". The old name check is gone with its substring match over the whole profile and its sentence initial soft class (D-017); the sentence start signal fired zero times on the 519 edits and a capitalised verb is a verb.

**The lexicon did not ship.** The design carried a curated list of about 250 tools, languages and qualifications. Measured against the posting signal over the same edits: the lexicon's only unique catch was "analytics", three edits, all in packets already held, so it held zero packets, and the posting signal held nine packets the lexicon could not see. A rule that holds zero packets is retired on that number, and a 250 word list that is wrong the day a new tool exists is not carried for nothing.

**Measured before it shipped**, as a delta on top of rule 2, the packets as restamped under D-021. One seeded resume, one user, one vocabulary, bullets only, no summary; the true rate on a real population is unknown and could be materially different in either direction.

| Rule 1, delta on the 76 packets ready under rule 2 | Packets |
|---|---|
| Newly held | 19, 25.0 percent |
| Of those, on a posting noun alone | 13 |
| Newly invalid | 0 |
| Held under rule 2 already, unchanged | 18 |
| Invalid, unchanged | 7 |
| Combined, of 101 with a candidate: held | 37, 36.6 percent |

What holds them: posting nouns lifted into claims, "feedback loops" on the OKR system, "identify usage trends", "partnering with senior leaders", "roadmap", "headcount", "prioritization"; responsibilities the cited fact does not name, "analysis" for "study", "dashboard" for "pack", "strategy" for "cycle"; and "KPI" by its form. Two artefacts were fixed before the number was quoted: a hyphenated compound split into fragments, "sales-adjacent" and "trade-offs", and six words that are not nouns fired on the suffix test, "complex", "clear", "use", "needs", now light words; "attention to detail" still fires, because both are nouns, and the narrowing below is what would clear it.

**The narrowing, logged, not built.** What the posting signal holds is two kinds of thing. "Roadmap", "prioritization", "headcount", "forecasts" are nouns lifted into a claim about what the person did. "Visibility", "alignment", "trends", "relationships", "concept", "benefits" are ordinary business vocabulary that happens to be in the posting and not on the resume, and matching the posting's vocabulary is a large part of why anyone tailors at all. The object signal already tells a claim object from decoration. The version worth measuring is the intersection, a posting noun in a claim position, and it is the first thing to measure when a held packet starts costing something.

**The held rate is a product fact.** 37 of 101 is about two in five applications held for a person to read. That is no longer a validator setting, it is the shape of the product: "Jobluvo submits the application" is not accurate for two in five packets under these rules. Either DOC-03 is a primary flow that every user meets several times a week, designed and staffed as such, or the rules are retuned against real users. It cannot be a fallback screen bolted on before submission. The current rate lives in the cost summary under "Held packets, the current rate", with the limit and that sentence beside it, and nobody designs DOC-03's capacity from 36.6 percent or assumes it will fall. Shipped at this rate because a held packet costs nothing today, nothing is submitted and the resume is kept for a person, while a shipped invention is permanent; while holds are free, buy the coverage. The reasoning inverts the day DOC-03 ships.

**The retry.** On the D-017 note: a finding that names its tokens is one the model can act on, so a held answer whose findings are on the actionable list, the rule 1 findings, the rule 2 subset finding, a missing or nonexistent citation, earns one retry. The retry prompt asks the model to replace the named word with the cited fact's own word, to use the cited fact's value and its meaning, to cite the fact where none was cited, and to keep every line and every value: a retry that deletes its way to a clean validator is the quiet degradation refused for review findings, and the only reason a word finding is different is that it names what to replace. If the retry comes back ready or held it is the packet; if it comes back rejected or fails, the held first answer stays, since it was validated and nothing is lost. The retry's success rate and its cost per packet are measured on a 20 job sample and reported as outcomes, ready, held again, invalid, failed, and a measured cost; no tailoring cost is quoted from arithmetic.

**The retry, measured.** Two 20 job samples on 18 September, changes mode, cost rows only and no packets stored (`npm run tailor-sample -- --n 20 --only changes --no-store`), on the current profile, the uploaded resume with 40 facts, not the seeded facts most stored packets were built on. Both samples fell entirely in the Ashby family, the stratified sample's known reproducibility gap (review three finding 17). Outcomes as measured, no arithmetic:

| 20 job sample | First answers | After the retry | Stored | Calls | USD in all |
|---|---|---|---|---|---|
| retry-18sep | 1 ready, 12 held, 7 rejected | held: 3 ready, 9 held; rejected: 1 ready, 6 held | 5 ready, 15 held, 0 invalid, 0 failed | 39 | 0.0213 |
| retry-18sep-b | 1 ready, 13 held, 6 rejected | held: 4 ready, 9 held; rejected: 1 ready, 4 held, 1 invalid | 6 ready, 13 held, 1 invalid, 0 failed | 39 | 0.0162 |

So the retry cleared 4 of 12 and 4 of 13 held first answers, and turned 7 of 7 and 5 of 6 rejected first answers into held or ready packets rather than invalid ones. What held the first answers, second sample, by finding: a word from the posting 43, a value bound to other words 7, a responsibility not in the cited facts 7, a value not in the cited facts 6 hard, a name 1. What the retry cleared: 15 posting words, 2 responsibilities, 1 hard value, 1 metric, 1 name. What holds the stored packets: the posting word alone on 8 of 13. The cost per packet on these samples is the sample's total over its 20 packets, USD 0.00107 and 0.00081, against USD 0.00078 in the cost summary for the earlier rule; the difference is the second call on 19 of 20 packets, offset by a higher cached share.

**The held rate on fresh answers is not the stored rate.** These samples hold 15 of 20 and 13 of 20, about seven in ten, against 37 of 101 on the stored packets. Same user, a different profile, fresh answers under the new prompt, one board family, and, found later (D-024), the same 20 jobs both times. That is the warning beside every figure in this sequence arriving within one user: the true rate on a real population is unknown, and here it moved by a factor of two on the same person. The cost summary's held rate stays the stored packets' figure, because that is what the status column states, with this paragraph pointed at from it.

**Noted, not acted on.** Twelve of the 101 packets have no edits at all: tailoring changed nothing and an untailored resume would go out under a tailored packet's name. Not a safety problem and not in scope here; an open quality question, because a packet that changed nothing is not a packet that worked. Also fixed in this change: a test on stale processing documents dated its fixture on this machine's clock with a one second margin against the database's clock and failed when the clocks disagreed; it now dates the row on the database clock. A test that fails sometimes is worse than none.

**Phase 0's closing list**, after the retry sample, is three items and nothing is added to it: `seen` required on bulk confirmation; the missing fact edit schemas; extraction atomicity with document eligibility on the single confirm path.

### D-021. A value is read from its own predicate, the metric test is a subset test, a period is a claim, and a line that cites nothing or cites a fact that does not exist is held

Review three finding 2, the part that ships on its own. The reviewer reproduced three lines the claim validator passed: "reduced customer churn by 11 percent" as "reduced customer acquisition costs by 11 percent", because one shared word was the metric test; "reduced costs by 20 percent; increased revenue by 10 percent" as "increased revenue by 20 percent and reduced costs by 10 percent", because a clause with both an up and a down word had no direction and each number borrowed the whole clause's words; and "over 12 months" as "annually", because the period was never read.

**The rules now**, `src/server/packet/claims.ts` and `validate.ts`. A clause splits into predicate segments at "and" and "while" wherever the next piece carries a value of its own, and each value reads its words and its direction from its own segment; a segment with no words of its own, "or USD 9.2M a year", measures what the segment before it measured. The segment's opening verb is not a metric word, because it says what the person did and not what the value measures, so "Led" for "Ran" is a rewording and rule 1's business; it is kept when it is the only word, "Revenue grew 20 percent". The metric test is a subset test: every metric word of the line's predicate, as a lemma, must be in the fact's sentence. The line side is its own predicate, so a value cannot borrow words from elsewhere in the line; the fact side is its whole sentence, so a line that folds the fact's own descriptive clauses into one predicate passes. "Annually", "a year", "per year", "each quarter" are period claims, `period:year`, and a period the cited fact never gave is hard like any other value. A cited fact id that does not exist holds the line, it was soft; a line that cites nothing holds, it passed when it had no value. Kind, unit, role and direction contradictions are hard as before.

**Measured before it shipped**, `npm run validator-report`, the same 101 packets and 519 bullet edits, one seeded resume, one user, one vocabulary, bullets only, no summary. That limit stands beside every number here and every time one is quoted; the 4 percent in D-017 was quoted without it. The table is the measurement on this date; the current held rate is stated once, in the cost summary under "Held packets, the current rate", and this entry is what changed it.

| Rule 2 alone over the stored packets | Packets |
|---|---|
| Ready today | 90 |
| Of those, held under rule 2 | 14, 15.6 percent |
| Of those, invalid under rule 2 | 0 |
| Held today, unchanged | 4 |
| Invalid today, unchanged | 7 |
| Edits held on the subset test | 19 of 519 |

What holds the 14: a noun attached to the value's predicate that its fact never gave. "Improving KPI reporting and removing about 12 hours", "using product data to remove about 12 hours", "the USD 18M deal" for "the one that closed", "leading workstreams on the last 5 and using data to guide strategic decisions", "managing 6 strategy professionals" for "team of 6". Two of those are the known D-017 holds. Some are paraphrase, "deal", "transaction", and the rule cannot tell a paraphrase noun from an invented one; that is what rule 1's redesign is for, and until it exists these are held, not passed. Rule 1 may move some of the 14 back to ready as well as hold more, so the rate can go down as well as up, and 15.6 percent is not a floor. Shipped at 14 of 90 because nothing consumes packets: submission is gated behind DOC-03 (D-017), so a held packet costs nothing today and holding a correct fix to finding 2 to avoid restating a number once is the wrong trade. Applied after the merge on 18 September.

Two false holds were found by the measurement and fixed before the number above: a period claim took a target role from the noun "targets" ("present targets to the board twice a year"), 7 packets wrongly invalid; and the fact side of the subset test was the fact's own segment, so a line that folded the fact's comma clauses into one predicate was held, 6 packets. The first run read 20 held and 6 invalid; both were the mechanism, not the data.

**The hole, named**: a fact sentence with two predicates and one direction, "reduced churn 11 percent, and cut acquisition cost 5 percent", supports a line that pairs 11 percent with acquisition cost, because the fact side is the sentence. Direction and role still bind per segment, so the swapped 20 and 10 percent stay hard.

### D-020. Word numbers compose along the grammar only, an unreadable number phrase holds the line, and a validator that throws is a failed packet

Review three finding 4. The normaliser looked words up with `in` on a plain object, so every key of Object.prototype read as a number: "constructor injection" made the accumulator a function and `fmt` threw. It added any two number words with "and" between them, "three and five teams" as 8, and read "two million five hundred thousand" as two numbers. And the throw aborted `tailorJob` before a row was written, because the fact set was built outside the try and the validator was not wrapped: not a wrong answer, a missing row, invisible to the cost and citation reports.

The rules now, `src/server/packet/normalise.ts`: the tables are Maps. A units word joins a tens word, a hundred, a scale word or the "and" after those, and after anything else it starts a new number; "hundred" scales the group before it; scale words must fall and carry a group; "and" is part of a number only after "hundred" or a scale word, and only when a number word follows. So "three and five teams" is "3 and 5 teams", and a line that says 8 is an invention, hard. A phrase the grammar cannot read, "five thousand two million", is left as its words and reported by `readNumbers`, and the validator holds the line: a review finding on the line's own phrase, and a value checked against a cited fact that has such a phrase is held rather than rejected, because the fact may hold it. A validator that throws on the facts stores a failed packet with zero attempts and no call; one that throws on an answer stores a failed packet with the call's cost row and no paid retry, since a code defect does not earn a second call.

Measured before it shipped, `npm run validator-report` over the 101 packets on hand: 0 changed status, 0 unreadable phrases on either side, 0 lines the old "and" rule had summed. Applied after the merge.

The hold rather than the pass: the old rule guessed a number where it could not read one, and a guess on the fact's side can only ever pass a line. A held line costs a review behind the DOC-03 gate. A passed invention costs the guarantee.

### D-019. Review two closed: what is done, what is declined, and where the rest goes before, with, or after the phase 1 pre rank

The phase 0 code review of 17 September 2026 listed eighteen findings. Seven were fixed in the review's own order, one was declined with its argument recorded, one was found live inside the last fix, and the rest are placed here by one rule: the phase 1 pre rank ranks jobs on stored text and produces the number the business case rests on, so anything that corrupts the stored text or the spend is fixed before it, or the pre rank is measured on bad inputs and believed.

| Finding | State |
|---|---|
| 1 A rejected result promoted after a failed retry | Done, #29 |
| 2 Numeric validation checked presence, not meaning | Done, #34, D-017: claims with kind, unit, role, direction, and the employer rule |
| 3 Unsupported qualifications shipped as ready | Done, #34, D-017: mid sentence names and metric mismatches hold the packet; sentence initial names soft, the hole named |
| 4 Fact replacement not atomic | Done, #31, the decide path on the same lock |
| 5 Confirm all could select a failed upload | Done, #32: document states, refusal reasons, Confirm all on the document displayed |
| 6 Employment facts confirmed unseen | Done, #33: every value shown and editable, decisions bound to the version seen |
| 7 No durable source claim | Declined, D-018, with the reviewer's argument and the triggers that would build it |
| 8 SDK retries and timeout | Done, #30, D-015: zero retries, budgets against the 60 s function, unknown cost and stale rows counted |
| 16 Wrong citation rate could read zero | Done, #34: the sample summary matches on the message across every level, counted by packet and edit; it had printed 0 for two samples because the message had moved from soft to hard |
| 12 Incomplete inventory treated as complete | Before the pre rank, first: a partial poll that closes live jobs changes what the whole system can see |
| 13 SmartRecruiters body stuck behind a 304 | Before the pre rank, second: a board whose descriptions never arrive gives the filter and the pre rank nothing to read, for one family, silently |
| 10 Rescore bypasses eligibility | Before the pre rank, third: model spend on jobs the user can never take, on the cost number directly |
| 15 Parser false negatives and the EUR decimal | Before the pre rank, fourth: location and compensation are filter inputs, and the decimal is a wrong number on a screen |
| 17 Sample not reproducible from its seed | Before the pre rank, fifth: cost per application is re-measured with the pre rank in place, and the point is the comparison with phase 0 |
| 9 Cache write term ignored by the meter | With the pre rank: it cannot move the published number by more than about USD 0.0004 on a hundred calls, but the pre rank changes the call mix, so the meter is fixed while that work is open rather than reasoned about a second time |
| 11 Score freshness, ownership, terminal states | With the freshness work planned for phase 1, as one item: it carries the request id per call, the cron stopping when time is short, the attempt history table (D-016) and a new revision restarting attempts. Fine at nine boards, mandatory before a thousand, not to be split further |
| 14 Boilerplate change does not rehash every row | After phase 1: bites only when a boilerplate rule changes |
| 18 Extraction forces precise dates | After phase 1: real product quality, on a profile the user can edit |

Also in this pass, not on the review's list: the packet attempt history became a measurement requirement (D-016), and submission does not ship before DOC-03 (D-017).

### D-018. Source polling keeps its claim and no lease, again, with the reviewer's argument recorded and the trigger that would change it

The phase 0 review asked for a durable claim on source polling: a lease owner and expiry on the row, exclusion of sources under an active lease, the same token required to publish, recovery of expired leases. Declined once before at nine boards with one daily cron, and declined again on this date, with the reviewer's argument written down because it is better than the earlier one.

The argument: the claim uses `FOR UPDATE SKIP LOCKED` and sets `last_status` to polling, but its row lock ends with the statement, so a second invocation can claim the same source while the first is still fetching. The employer lock serialises the database processing, not the fetch, so an older snapshot fetched by the first invocation can be processed after a newer one fetched by the second, and absence handling then reads from the older snapshot. That is correct. It is not what the code faces: one Vercel cron invocation a day, sixty seconds long, a poll well under that, so two invocations never overlap. The only second writer is `npm run ingest` by hand, an operator action against a schedule the operator can see. A lease system is a table column, a token through every publish path, a recovery sweep and their tests, for a race that requires an invocation that does not exist.

What would make us build it, any one of these: a second scheduled invocation, or a cadence shorter than a poll's duration, which the always on worker or a fifteen minute cron on Vercel Pro would be; more than one worker process; or the first observed out of order snapshot, which is detectable as `last_success_at` moving backwards on a source or a closed job reopening without a board change. The freshness target that sizes the schedule (the note under D-008) decides the cadence, and the cadence decides this.

### D-017. The validator reads claims, not numbers; a held packet cannot be consumed; sentence initial names are soft; the status column means the rules as they stand; submission does not ship before DOC-03

The phase 0 review reproduced three rewrites the cited value rule (D-013) passed because the number was in the cited fact: "reduced churn by 11 percent" as "managed 11 teams", "12 months" as "12 years", a 12 percent target as a 12 percent result. And an invented tool, "Salesforce", was soft and shipped. The rule "the number is in a cited fact" checked a value's presence and nothing of its meaning.

**The claim.** Every value in a fact and in a proposed line is read as a claim (`src/server/packet/claims.ts`): the value; its kind, percentage, money, date, year, duration or count; its unit, the currency, the time word or the counted noun with the noun run around it; the content words of its clause as the metric; its role, result, target or baseline, from the markers around it; its direction, up or down, from the verbs; and for a fact, the row it came from and the row's origin, upload with the resume's words, edit typed over them, or user entered. A line's claim is supported by a claim of a cited fact with the same value, the same kind, unit and role, and no contradicting direction.

**Outcomes.** Hard, one retry then invalid with no resume: a value in no cited fact as before, and now a value whose kind, unit, role or direction changed on the way, each a contradiction the model can fix from the finding. Held for review, `needs_review`, no retry, resume stored but not consumable: a value whose metric words differ or cannot be read, and a name in no fact. Soft, travels with the packet: a sentence initial name in no fact, and a value supported by a fact the user typed, which carries the origin so the review screen can say "this number is from a line you wrote, the resume said X". No retry for review because a retry exists to fix something the model can fix from the findings; review is the validator saying it could not read one side, a retry cannot resolve that, and all it can do is make the model drop the line to be safe, which trades resume quality for a quieter validator with nobody deciding it. Metric overlap is review rather than hard because shared content words are a crude synonym test, churn rewritten as customer attrition shares no word and is true, and until DOC-03 exists hard and review both stop the packet, differing only in what survives for a person; the check with a known false positive mode takes the outcome that keeps the resume and the finding. It can be promoted to hard later with data; a hard rule that rejects truthful resumes is not backed out as easily.

**The employer rule.** A line under one role may cite employment facts of that role only. Hard, no ambiguity in a row id. The number is real, the win is real, the employer is wrong is the most valuable lie a resume can tell, and no value check sees it. Skills and degrees may be cited under any role; the summary draws on every role.

**Measured before it shipped**, `npm run validator-report`, over every packet on the database: 101 packets, 519 bullet edits, 81 built on the retired seeded facts and rebuilt from the rejected rows by hash, 20 on the current profile, 0 excluded, summaries not replayed because the stored packet keeps only its bullet changes (D-016). The first run showed 20 percent of ready packets invalid, all of it the reader: a count noun followed by a verb ("38 teams use it"), a longer noun phrase ("14 fleet software acquisition targets"), a count's own noun acting as a target marker for the value after it, "11 units into 6" not read as a baseline, and a number word before a full stop ("team of six.") that the old normaliser never read as a number, a gap in the old validator too. Each fixed and in the tests. Settled:

| Of 99 packets ready before | Packets | Percent | What |
|---|---|---|---|
| Invalid | 5 | 5.1 | all "managing six", the known invention, built before the cited rule shipped and never re-validated |
| Held for review, sentence initial names as review | 16 | 16.2 | 12 on a capitalised verb the resume never used ("Owned" 10, "Established" 2), 2 on "KPI", 2 on "team of 6" rewritten as "6 strategy professionals" |
| Held for review, sentence initial names as soft | 4 | 4.0 | 2 on "KPI", 2 on the six rewrite, every one a line a person should look at |
| Kind, unit, role or direction contradictions | 0 | | |
| Employer rule | 0 | | |

**Sentence initial names are soft**, on 12 of 12 false positives. The hole accepted is precise: a mid sentence invented name is still held, so what soft covers is an invented proper noun in the first position of a line, and only there. The sample is one seeded resume from one user, 101 packets; twelve of twelve is convincing about that resume's verb vocabulary, not about everyone's. If the hole shows up, the upgrade is cheap and is written here so it is not rediscovered: a real proper noun is capitalised wherever it appears and a verb only after a full stop, so a token that appears in lower case anywhere else in the document or the profile corpus is not a name. Not built at 0 occurrences.

**The status column means "passes the rules as they stand".** Five packets sat at ready carrying the managing six invention that the cited rule rejects, because nothing re-validated them when the rule shipped, and this change adds the one function that hands a ready packet's resume downstream. So the rule is: when a validation rule changes, `npm run validator-report` runs first as the measurement and then with `--apply`, which restamps every replayed packet's status, findings and, for a packet that fails today, its resume, keeping a summary's old findings since the summary cannot be replayed. Applied on this date: of 99 ready packets 5 became invalid, 4 became held and 90 stayed ready; the 2 invalid stayed invalid. The alternative, keeping the status as a record of the time and making the downstream function check a rules version, was not taken: a word that means different things by date is not a gate.

**Correction on 17 September, review three finding 1: the figures above came from a defective replay.** The `--apply` that produced "5 became invalid, 4 became held and 90 stayed ready" was wrong in three ways. It derived the status from the replayed bullet findings alone, so a summary finding it kept beside them was written into the row but never counted, and a packet held or rejected by its summary alone would have been stamped ready with its resume intact, behind the one door. It replayed failed packets, whose empty change set is the absence of an answer, and would have stamped them ready. And it re-hashed each resume as jsonb gave it back, keys in the database's order, so `resume_hash` on every row with a resume stopped naming the document the run had hashed. The re-run that "read zero divergence" was the same computation agreeing with itself. Fixed in #35: `src/server/packet/replay.ts` derives the status from every finding the row will carry, does not replay a failed packet, stamps ready or held only a resume that is the base plus the stored changes and summary, and refuses a write when the row moved since it was read; `resumeHash` now hashes the document's shape, so a stored hash can be checked against a stored resume. Recomputed under the corrected replay, then applied, over the same 101 packets:

| Corrected replay, 101 packets | Packets |
|---|---|
| Ready | 90 |
| Held for review | 4 |
| Invalid | 7 |
| Status changed by the corrected replay | 0 |
| Failed, not replayed | 0 |
| Passes today but no resume to promote | 0 |
| `resume_hash` wrong before, repaired by the apply | 94 of 94 |

The defective figure and the corrected one agree because of the data, not the code: the 6 summary findings kept from the original run are all soft and decide nothing, there is no failed packet on hand, each of the 7 invalid packets carries a hard bullet finding of its own, and all 94 stored resumes are the base plus their stored changes. On other data the first replay would have promoted held and failed packets. The held rate the gate below is argued from was 4 of 101 packets with a candidate, 4.0 percent, recomputed rather than assumed, and the gate stands. That figure is superseded on 18 September by rule 2 (D-021); the current rate is in the cost summary under "Held packets, the current rate".

**Note on 18 September, on the retry.** The reason above for no retry on a review finding is stated too broadly. It holds for a finding that expresses uncertainty, the validator could not read one side and a second call cannot resolve that. It does not hold for a finding the model can act on, one that names the words or the value that failed; that is the same shape as a hard finding, and a retry that carries it can fix it, with a second held answer stored held so nothing is lost. The distinction is a finding the model can act on against a finding that expresses uncertainty, not review against hard. Whether such findings get a retry is decided with rule 1's redesign, because the rule sets the held rate and the held rate sets what a retry costs.

**What 4 percent meant on 17 September, and the gate it forces. Superseded on 18 September: the current held rate is stated once, in `design/docs/07-Phase-0-Cost-Summary.md` under "Held packets, the current rate", and rule 2 (D-021) changed it.** The unit is packets, not users: one held packet every twenty fifth application, for every user. A Starter account at 750 applications a month meets about 30, a weekly event for everyone who pays. A held packet with no screen to resolve it is an application the user paid for and cannot send. So submission does not ship before DOC-03, the packet review screen, hard. That does not move DOC-03 ahead of the phase 1 pre rank, because nothing can be submitted yet and the pre rank is the only work that moves the cost answer; it puts DOC-03 ahead of submission. `consumableResume` in `src/server/packet/run.ts` is the one door: only a ready packet's resume leaves through it.

### D-016. The packet attempt history is a measurement requirement, deferred

Since #29 each tailoring attempt owns its candidate, findings and outcome, and the packet row is the last attempt. That closed the promotion path: a rejected candidate can no longer become ready because the retry failed to parse. Its cost is that a packet invalid on attempt one and failed on attempt two stores an empty findings array; the fact that the model invented a value survives only as a hard finding count inside the error string. That is the right trade for correctness. But those rows are evidence: the wrong citation rate and the invention rate (D-013) are counted over findings, and a row whose findings were on an earlier attempt drops out of both. So the immutable attempt history the review names as design improvement B, one row per attempt with its findings, its change set and its outcome, and the packet pointing at the latest attempt and separately at the latest valid one, is what restores the measurement, not a nicety. Due with the review's item 9, attempt ownership and terminal states, where a schema change is already planned. Until then the stored findings count what the last attempt found, and the sample summary must say so.

### D-015. The SDK never retries and every model call carries a timeout chosen against the 60 second function

The client was built with the SDK's defaults: two retries on a timeout, a lost connection, 408, 409, 429 or any 5xx, and a ten minute timeout. Both were wrong for this code. A retry underneath `tailorCall` or the scoring call is a call the meter never sees: the caller writes one cost row per call it makes, and a generation the provider completed and billed before the response was lost would be paid for again with no row for it, unmetered spend inside the number phase 0 exists to produce. And the routes that call a model declare `maxDuration = 60`, the Vercel Hobby ceiling, so the ten minute timeout could never fire; the function would be killed first, with no error and no usage.

Now `maxRetries` is 0 on the client and on every request, because the attempt loops in run.ts and the claim already own retries and count them; two retry layers is how a two call packet becomes four paid calls. Each call site states its own budget from the 60 s ceiling and the client refuses one above 40 s:

| Call | Timeout | Budget | Measured on this date |
|---|---|---|---|
| Scoring | 12 s | SCORE_BATCH 20 at concurrency 5 is four waves, 48 s, 12 s left for the claim and the writes | 400 calls: p50 2.5 s, p99 7.6 s, max 10.5 s |
| Tailoring | 20 s | two attempts per packet, 40 s, 20 s left for the facts, the validator and the packet row | 228 calls: p50 4.5 s, p99 10.6 s, max 17.1 s |
| Extraction | 40 s | one call per upload, 20 s left for the file and the writes | 17 calls: p50 10.6 s, p99 18.5 s, max 18.7 s; 8.6 ms per output token, so the 4,000 token cap fits in 34 s |

A call that times out or loses its connection is a call of unknown cost: no usage came back and the provider may have finished and billed it. It is reported as such, no cost row is written, and the message carries a fixed phrase into the match or packet row's error text. `npm run cost-report` counts those rows by kind and prints a worst case at the kind's mean cost per call beside the recorded spend, so the invisible retry has not been traded for an invisible timeout; that line is also the check on the budgets above, since a rising count says the margin over the observed max was wrong. A row counts once whatever its attempts, so the count is a floor. Extraction cannot be counted this way: a failed upload stores no error text on the document, so its unknown calls wait for the document status column that review finding 5 asks for. Recording the provider's request id against each call waits for the attempt ownership work (item 9).

Two behaviours follow from the values and are recorded here rather than discovered later. Neither is built now.

1. A timeout on tailoring attempt one ends the packet. The loop in run.ts breaks on a transport error, and packets have no attempts based requeue the way matches have one, so a single slow generation is a dead packet with no second call at either layer. That is fine for the phase 0 sample. On the product path an apply would fail in front of the user, so the retry decision for the apply path is an open item.
2. A scoring timeout marks the match failed and burns one of its three attempts. The claim picks failed rows with attempts under three up again, so one timeout is survivable, but three timeouts on one job leave it permanently failed and taking no slot; a new input revision restarting its own attempts is review finding 11 (item 9).

The budgets are thin on purpose: 12 s is 14 percent above the observed scoring max and 20 s is 17 percent above the observed tailoring max, and the tail they clear is provider latency, which is the thing that moves. They are defensible against the 60 s function and that constraint is real. Each is written next to its observed max in the code so the next change sees the headroom it spends.

Whether any row written before this date hides a retried call cannot be decided from the rows: nothing recorded a request id or a retry count. What the durations show: 52 of 400 scoring calls and 4 of 228 tailoring calls ran longer than twice the median plus the SDK's first backoff, which is what one billed retry would look like and also what a slow generation looks like. If every one of them hid one billed call the unrecorded spend would be USD 0.026 on scoring and 0.003 on tailoring against USD 0.20 and 0.17 recorded, and the per call figures in D-011 and D-013 would be at most 13 and 2 percent low. The slowest tailoring call, 17.1 s for 326 output tokens against 14.7 ms per token typical, is the one row that looks most like a hidden retry. None of this moves the phase 0 conclusion, which turns on the scored per applied ratio, and none of it is claimed as a correction.

### D-014. Extraction per user: USD 0.0021, the PDF sent as a file, no parser dependency

The third term of the cost per application (D-011), measured on this date with `npm run extract-sample`: Jack Miller's resume, rendered from his seeded facts by `npm run resume-pdf` so the extractor has a ground truth, sent five times as the PDF and five times as plain text to gpt-5.6-luna, reasoning off, strict JSON of the facts with the resume's own words as evidence for each.

| Input | Input tokens | Output tokens | USD, first call | USD, repeat |
|---|---|---|---|---|
| PDF as a file | 1,605 | 1,430 to 1,545 | 0.00218 | 0.00175 to 0.00189 |
| Plain text | 1,546 | 1,545 | 0.00216 | 0.00189 |

The product path is the first call: one resume, once per user, nothing to repeat. So extraction per user is USD 0.0021 on the corrected fixture, 0.0022 on the first. The API reads the PDF as text, 59 tokens more than the text itself, so a PDF parser would save nothing and none was added; the file goes to the model as it is. Output is 85 percent of the bill, because the facts come back in full with their evidence, and that is the point of the call.

What it read back, five of five runs the same: 4 of 4 roles with their dates, 18 of 18 bullets word for word, 16 of 16 skills, contact and link. The first fixture also carried a salary expectation and a notice period under "Other", read back 2 of 2; those are answers the user gives to application questions, not resume content, and the fixture was corrected on this date. On the corrected fixture, five runs, tag `sample-2026-09-17b-pdf`: 1,581 input tokens, 1,487 output, USD 0.0021 for the first call, the same roles, bullets and skills read back and no answers, as there are none to read. 1 of 2 degrees differed from the seed by reading the resume line literally, "MBA, Executive MBA, part time" as the degree, which is what the line says. The extractor copies; it does not tidy. The accuracy is circular: the resume was rendered from the seeded facts, one column, plain headings, so reading them back word for word tests the pipeline, not extraction. The cost is real and representative; the accuracy is not, and a real resume has two columns, tables, date ranges and inconsistent headings.

Nothing extracted is read until confirmed (ID-03). The confirmation screen lists every extracted fact with its evidence, Confirm and Reject per line, and Confirm all, which confirms the document's facts and retires the confirmed resume facts before it as rejected, never deleted (DOC-06). Preference, authorization and sponsorship facts are the user's own answers and are never touched. Jack's seeded resume facts were replaced this way on this date: 26 confirmed from the upload, 24 seeded now rejected. With the facts hash moved, the scoring cron reworks his scored matches on its next run and the packets built on the old facts read as stale.

### D-013. Tailoring is a change set, not a document: USD 0.00054 per packet, 55 percent of the whole document, with the validator as the guarantee

The second term of the cost per application (D-011), measured on this date with `npm run tailor-sample` over the same 100 jobs as the scoring sample, on gpt-5.6-luna, reasoning off. The facts message, every confirmed fact with an id, was 4,638 characters, 42 facts, about 1,160 tokens; the cached block, instructions plus facts, was 1,521 tokens on every call after the first.

| Mode | Calls | Output p50 | USD p10 | USD p50 | USD p90 | USD mean | USD max | Per packet |
|---|---|---|---|---|---|---|---|---|
| Change set, shipped | 101 for 100 packets | 322 | 0.000268 | 0.000570 | 0.000665 | 0.000533 | 0.000710 | 0.000538 |
| Whole document | 100 | 648 | 0.000893 | 0.000963 | 0.001049 | 0.000969 | 0.001201 | 0.000969 |

The model emits only the edits, which bullet is replaced, by what text, citing which facts, plus an optional top line and a skill order, and the code assembles the document. Five edits per packet on average. That halves the output tokens and costs 55 percent of the whole document, and the diff the review screen needs (DOC-03) is the change set itself rather than a comparison of two long strings afterwards. By length the change set runs USD 0.000436 short, 0.000513 medium, 0.000624 long.

The validator is not a cost device. It is what makes "nothing is added that is not on your profile" true: both sides are normalised (eight and 8, USD 2.3M and 2.3 million, Jan 2023 and January 2023, twenty five and 25), every number, amount, percentage and date in a proposed line must appear in some confirmed fact or the packet is rejected, one retry with the findings, then stored as invalid rather than passed. A wrong citation, a name in no fact, an edit to a line that does not exist are soft and travel with the packet. Arithmetic over facts is a new claim: four managers and two analysts is not a team of six on the profile. On the sample: 100 of 100 packets ready in each mode, 1 retry whose first answer carried a hard finding and whose second passed, 0 stored invalid; soft findings on the stored attempts were 8 uses of KPI, a term on no fact; 3 name findings on the model's summary line that were the tokeniser's own doing, it stripped the commas from "PMO, OKR" and "SQL, Power BI" and joined the neighbours into one name, plus one plural, "PMOs"; and 5 citations that did not carry the value they were cited for. The tokeniser now ends a name at a comma, semicolon or slash and a plural of a known name is known; a run of known words is still looked up whole, so two known words run together stay flagged. The 5 wrong citations were one pattern: "managing six strategy managers and analysts" on R1.1, which is four managers and two analysts added together. The value 6 is on the profile elsewhere, so the hard rule passed it and only the citation check saw it; it stays soft by the rule as agreed, and the rate is tracked from here per sample, on the packets each run tags: 5 of 520 cited edits, 0.96 per 100. When the validator fires on a legitimate rephrasing the normaliser is fixed; the rule is never loosened. The validator's first failure in the field was in the validator itself, its tokeniser, not in the model's text; a validator is code and gets the same scrutiny as what it checks.

Tightened after the first sample: a value must appear in a fact the line cites, not merely somewhere on the profile. The profile wide rule asked whether a number existed anywhere in the facts, so any number on the profile could be attached to any sentence, and "six" passed because six was on another line. Measured before it shipped over the 520 edits of the first sample: 5 rejected, all five the same "managing six" line, 0 legitimate edits failing, so 0 false positives per 100. The summary line cites facts too now (`summary_facts`), and a line with a value and no citation is rejected. If legitimate edits start failing because they draw on facts they did not cite, the fix is to require better citations, never to widen the value rule back. Run on a fresh 20 job sample after it shipped, tag `sample-2026-09-17c-changes`: 18 ready, 2 stored invalid, both the same "managing six" line written again after the retry, 6 of 20 retried, 0 wrong citations on the stored attempts, USD 0.00078 per packet with the retries against 0.00054 without. The invention is caught every time now; what it costs is the retry, and the two packets the model would not correct are invalid rather than shown.

Answers, the salary expectation and the notice period, are what the user tells an application form and are not resume content. They are not in the fact set the tailor sees or cites, so no figure from them can reach a resume line, and the fixture resume no longer carries them.

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
