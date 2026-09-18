# Reconciliation of families-18sep-changes, read from design/snapshots/2026-09-18-packets

Packets 80, saved answers 80, cost rows 128. Profile c9f231127f13, 40 facts. Rules as they stand at the code revision this ran on; the baseline is the stored status and findings, read before any rule was applied.

The answers carry no header: written before a sample recorded what produced it (finding 18). The model, the prompt revision and the validator revision behind them are not on record and are not guessed here.

## Statuses, three readings of the same 80 answers

| Reading | Ready | Held | Invalid | None |
|---|---|---|---|---|
| Stored status, the retained attempt as the run wrote it | 54 | 24 | 2 | 0 |
| Retained attempt re-read under the rules as they stand | 53 | 25 | 2 | 0 |
| Last attempt re-read, what the scope table in tailor-sample counted | 53 | 22 | 5 | 0 |

## Where the readings differ, by packet

- 76: same on every reading
- 3: retained attempt differs from the last attempt (finding 13)
- 1: retained attempt re-reads as needs_review, stored ready: a rule or input difference, not attempt selection

| Packet | Stored | Attempts as run | Retained | Re-read per attempt | Category |
|---|---|---|---|---|---|
| 67793c88 | needs_review | needs_review > invalid | 1 | needs_review > invalid | retained attempt differs from the last attempt (finding 13) |
| 1e23eacd | needs_review | needs_review > invalid | 1 | needs_review > invalid | retained attempt differs from the last attempt (finding 13) |
| 6c9f0179 | needs_review | needs_review > invalid | 1 | needs_review > invalid | retained attempt differs from the last attempt (finding 13) |
| ea70de4d | ready | ready | 1 | needs_review | retained attempt re-reads as needs_review, stored ready: a rule or input difference, not attempt selection |

## Findings the rules as they stand add or remove on the retained attempts

| Added, by finding | Edits | Packets |
|---|---|---|
| review: word from the posting appears in no confirmed fact | 2 | 1 |
| review: responsibility is not in the cited facts | 1 | 1 |

| Removed, by finding | Edits |
|---|---|

## Unchanged packets, the whole document against the base

Packets with a stored resume 78. Identical to the base resume, summary and skill order included: 13. Packets with zero bullet edits: 24, of which 11 are also identical as a whole document and 13 changed the summary or skill order only.

| Unchanged whole document | Ready | Held | Invalid |
|---|---|---|---|
| 13 | 13 | 0 | 0 |

## What a retry did to the first answer

Retried packets with two parsed answers: 48.

| Retry outcome | Packets |
|---|---|
| dropped 5 of 6 edited lines; retained attempt 2 | 12 |
| dropped 6 of 7 edited lines; retained attempt 2 | 6 |
| edited a different set of lines; retained attempt 2 | 5 |
| dropped 5 of 7 edited lines; retained attempt 2 | 3 |
| dropped 2 of 7 edited lines; retained attempt 2 | 3 |
| dropped 3 of 5 edited lines; retained attempt 2 | 2 |
| reverted to the base resume; retained attempt 2 | 2 |
| dropped 4 of 5 edited lines; retained attempt 2 | 2 |
| kept every edited line, substituted; retained attempt 2 | 2 |
| edited a different set of lines; retained attempt 1 | 2 |
| dropped 3 of 4 edited lines; retained attempt 2 | 1 |
| dropped 2 of 6 edited lines; retained attempt 2 | 1 |
| dropped 1 of 6 edited lines; retained attempt 2 | 1 |
| dropped 1 of 5 edited lines; retained attempt 2 | 1 |
| dropped 6 of 6 edited lines; retained attempt 2 | 1 |
| dropped 4 of 6 edited lines; retained attempt 1 | 1 |
| dropped 4 of 5 edited lines and the skill order; retained attempt 2 | 1 |
| dropped 4 of 6 edited lines; retained attempt 2 | 1 |
| dropped 1 of 7 edited lines; retained attempt 2 | 1 |

| Packet | Stored | Attempts as run | Bullet edits stored | Whole document changed | Retry |
|---|---|---|---|---|---|
| 612aaa90 | needs_review | needs_review > needs_review | 1 | true | dropped 6 of 7 edited lines; retained attempt 2 |
| 02349250 | ready | needs_review > ready | 1 | true | dropped 5 of 6 edited lines; retained attempt 2 |
| 19bf8585 | ready | needs_review > ready | 0 | true | dropped 5 of 6 edited lines; retained attempt 2 |
| 2f7022c4 | ready | needs_review > ready | 0 | true | dropped 3 of 4 edited lines; retained attempt 2 |
| 4ddbeb94 | ready | invalid > ready | 1 | true | dropped 5 of 7 edited lines; retained attempt 2 |
| dab28b2c | ready | needs_review > ready | 5 | true | dropped 3 of 5 edited lines; retained attempt 2 |
| 84c57e99 | ready | needs_review > ready | 1 | false | reverted to the base resume; retained attempt 2 |
| ba176a50 | needs_review | needs_review > needs_review | 0 | true | dropped 5 of 6 edited lines; retained attempt 2 |
| 9f70c336 | needs_review | invalid > needs_review | 4 | true | dropped 2 of 6 edited lines; retained attempt 2 |
| a6dd7f22 | needs_review | needs_review > needs_review | 1 | true | dropped 6 of 7 edited lines; retained attempt 2 |
| 7055d584 | ready | invalid > ready | 5 | true | dropped 1 of 6 edited lines; retained attempt 2 |
| 4a8ce1a2 | needs_review | needs_review > needs_review | 0 | true | dropped 4 of 5 edited lines; retained attempt 2 |
| 334f4cf4 | ready | needs_review > ready | 1 | true | dropped 4 of 5 edited lines; retained attempt 2 |
| 8747127c | ready | needs_review > ready | 2 | true | dropped 6 of 7 edited lines; retained attempt 2 |
| feb471bd | invalid | invalid > invalid | 6 | null | dropped 2 of 7 edited lines; retained attempt 2 |
| a9fdc52d | ready | invalid > ready | 6 | true | kept every edited line, substituted; retained attempt 2 |
| 9043c77e | ready | needs_review > ready | 1 | false | reverted to the base resume; retained attempt 2 |
| 8e753641 | needs_review | needs_review > needs_review | 6 | true | edited a different set of lines; retained attempt 2 |
| 67793c88 | needs_review | needs_review > invalid | 6 | true | edited a different set of lines; retained attempt 1 |
| cf4b1193 | invalid | invalid > invalid | 6 | null | edited a different set of lines; retained attempt 2 |
| c4ab934d | ready | needs_review > ready | 1 | true | dropped 5 of 6 edited lines; retained attempt 2 |
| 3ffcc61c | needs_review | invalid > needs_review | 6 | true | dropped 1 of 5 edited lines; retained attempt 2 |
| 50f7cb8f | ready | needs_review > ready | 0 | true | dropped 6 of 7 edited lines; retained attempt 2 |
| 9cc696fa | ready | needs_review > ready | 2 | true | dropped 5 of 6 edited lines; retained attempt 2 |
| 1e23eacd | needs_review | needs_review > invalid | 6 | true | edited a different set of lines; retained attempt 1 |
| f02eec81 | ready | needs_review > ready | 6 | true | dropped 2 of 7 edited lines; retained attempt 2 |
| 0daf5071 | needs_review | needs_review > needs_review | 2 | true | dropped 6 of 7 edited lines; retained attempt 2 |
| c0090e69 | ready | needs_review > ready | 2 | true | dropped 6 of 6 edited lines; retained attempt 2 |
| 6c9f0179 | needs_review | needs_review > invalid | 6 | true | dropped 4 of 6 edited lines; retained attempt 1 |
| 7fe6fa89 | ready | needs_review > ready | 0 | true | dropped 4 of 5 edited lines and the skill order; retained attempt 2 |
| 2ef86c9b | needs_review | needs_review > needs_review | 0 | true | dropped 5 of 6 edited lines; retained attempt 2 |
| e6bdc105 | ready | invalid > ready | 6 | true | edited a different set of lines; retained attempt 2 |
| 936289f0 | needs_review | invalid > needs_review | 6 | true | dropped 2 of 7 edited lines; retained attempt 2 |
| db4115c1 | ready | invalid > ready | 0 | true | dropped 5 of 6 edited lines; retained attempt 2 |
| 4f435e73 | needs_review | invalid > needs_review | 1 | true | dropped 5 of 7 edited lines; retained attempt 2 |
| bba3d4e9 | needs_review | needs_review > needs_review | 2 | true | dropped 6 of 7 edited lines; retained attempt 2 |
| 87ad9d63 | ready | needs_review > ready | 1 | true | dropped 4 of 6 edited lines; retained attempt 2 |
| 74a14ed2 | ready | needs_review > ready | 5 | true | edited a different set of lines; retained attempt 2 |
| 849d7cbb | needs_review | needs_review > needs_review | 1 | true | dropped 3 of 5 edited lines; retained attempt 2 |
| 170ae280 | needs_review | needs_review > needs_review | 1 | true | dropped 5 of 6 edited lines; retained attempt 2 |
| 690aaa69 | needs_review | needs_review > needs_review | 3 | true | dropped 5 of 6 edited lines; retained attempt 2 |
| 81573d8d | needs_review | invalid > needs_review | 6 | true | dropped 1 of 7 edited lines; retained attempt 2 |
| a3df7424 | needs_review | invalid > needs_review | 1 | true | dropped 5 of 7 edited lines; retained attempt 2 |
| 9325f3b9 | needs_review | invalid > needs_review | 6 | true | edited a different set of lines; retained attempt 2 |
| b72121cf | needs_review | needs_review > needs_review | 0 | true | kept every edited line, substituted; retained attempt 2 |
| 706b977c | needs_review | needs_review > needs_review | 0 | true | dropped 5 of 6 edited lines; retained attempt 2 |
| 11e5c420 | ready | needs_review > ready | 0 | true | dropped 5 of 6 edited lines; retained attempt 2 |
| 986548a1 | needs_review | needs_review > needs_review | 0 | true | dropped 5 of 6 edited lines; retained attempt 2 |

## What the merge rule of finding 14 changes on these answers

Retried packets with two parsed answers: 48, of which 45 kept the retry as the packet and are what the rule touches. The other 3 kept the first answer because the retry came back rejected or failed, and the merge does not apply to them.

| What the retry did | Packets | Lines dropped | Of those, clean |
|---|---|---|---|
| dropped edited lines | 35 | 146 | 125 |
| edited a different set of lines | 5 | 9 | 8 |
| reverted to the base resume | 3 | 16 | 12 |
| kept every edited line, substituted | 2 | 0 | 0 |

Lines put back in all: 145 across 42 packets. A dropped line the validator had objected to is never put back; the difference between the two columns above is those.

| Status of the retained answer | Ready | Held | Invalid |
|---|---|---|---|
| The retry as it came back, today's rule | 22 | 21 | 2 |
| The retry with its clean dropped lines put back | 22 | 21 | 2 |

Packets whose status moves: 0.

## Lines not supported by what they cite, first attempt against retained

Answers with both a first and a retained attempt parsed: 80 of 80. Counted in cited bullet edits, the same unit on both rows; a line failing in two ways counts once in "any" and once in each kind.

| Attempt | Cited edits | numeric support | unsupported responsibility | missing citation | wrong role | Any kind | Per 100 | Unrecognised |
|---|---|---|---|---|---|---|---|---|
| First attempt | 394 | 25 | 22 | 0 | 0 | 39 | 9.90 | 0 |
| Retained attempt | 240 | 4 | 2 | 0 | 0 | 5 | 2.08 | 0 |

### What became of the first attempt's unsupported lines

Unsupported lines on the first attempt: 39. On the retained attempt: 5. What became of each of the 39:

| What became of it | Lines | Share of the first attempt's |
|---|---|---|
| Corrected, the line is still there and is now supported | 19 | 48.7 percent |
| Deleted, the line is gone and its problem with it | 16 | 41.0 percent |
| Retained, the same unsupported claim | 3 | 7.7 percent |
| Replaced by a different unsupported claim | 1 | 2.6 percent |

**The retry corrects about half of what it is sent back for and deletes about two fifths of it.**

Unsupported lines on the retained attempt that were not unsupported on the first: 1. The retained total 5 is 3 retained plus 1 replaced plus 1 new, which is how the two counts reconcile.

Correction to an earlier reading of these same numbers: it said 39 percent of the fall in the rate was the denominator. That is arithmetically backwards. A smaller denominator raises a rate when the numerator holds: 39 over the retained attempt's 240 cited lines would be 16.25 per 100, above the first attempt's 9.90. The whole fall came from the numerator. What the denominator hides is not the rate but the deletions, which the table above counts directly.

First few, line by line:

- 0a33383c R2.2 deleted: was responsibility-not-in-cited:strategy
- 0a33383c R2.4 deleted: was responsibility-not-in-cited:strategy
- 8067f6b1 R1.6 corrected: was responsibility-not-in-cited:model
- 8067f6b1 R1.2 corrected: was metric-differs:num:3, metric-differs:num:4
- 8067f6b1 R1.1 retained: was value-not-in-cited:num:6, now value-not-in-cited:num:6
- eea5d175 R1.6 corrected: was value-not-in-cited:num:1
- 29afe8b8 R1.1 corrected: was responsibility-not-in-cited:staff, value-not-in-cited:num:6
- 705cfbaa R1.1 deleted: was responsibility-not-in-cited:members, value-not-in-cited:num:6
- 90711d78 R1.5 deleted: was metric-differs:money:usd:18000000
- 0bc36f1b R1.3 deleted: was responsibility-not-in-cited:strategy
- 0bc36f1b R2.4 deleted: was responsibility-not-in-cited:analysis
- 5b83a366 R1.5 deleted: was metric-differs:money:usd:18000000

## Spend, every cost row tied to an attempt

Cost rows 128, USD 0.0610 in all; 128 rows tie one to one to an attempt of a packet in the run; 0 rows belong to no packet of the run. Rows recorded by our own client from the provider's usage field; the provider's bill is not in the snapshot and completeness against it is not established here.
Every packet's cost rows count its attempts and sum to the USD the packet and the saved answer carry.

