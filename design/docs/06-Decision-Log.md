# Jobluvo, decision log

Decisions taken during build that the other documents assume but do not state. Newest first. Each entry says what was decided, what it was measured against, and what it forbids.

Companions: [Product BRD](01-Product-BRD.md), [Implementation plan](02-Implementation-Plan.md), [ATS integration plan](04-Job-Parsing-and-ATS-Integration.md)

## 17 September 2026

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
