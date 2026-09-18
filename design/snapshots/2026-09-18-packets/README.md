# Packet population, frozen 18 September 2026

The packets table and everything needed to reproduce it, exported by `npm run snapshot-packets -- --out design/snapshots/2026-09-18-packets` at the time in `meta.json`, from code revision 71158a9 (main, D-028). Read only: the export wrote nothing to the database.

Why it exists. On 17 September at 22:57 UTC (18 September 01:57 in Istanbul) the 80 job cross family sample, run tag families-18sep, stored its packets because the sample script's flag parser read `--no-store --save <path>` as store true (review four, finding 12). That upsert replaced 74 of the 101 packets stored on 17 September and added 6, so the table holds 107 packets on two profiles. This snapshot freezes that state before any restamp or measurement touches it again. The 74 prior packet versions are absent from the current table. That question has since been answered on the Neon console: the project history retention window was 6 hours and the overwrite was about 17 hours before it was read, so point in time recovery cannot return them and they are unrecoverable (D-030). Retention is now 7 days.

## Files

| File | Rows | What it is |
|---|---|---|
| packets.json | 107 | every packet row, whole |
| cost_events.json | 1,085 | every cost row, whole, including the cron's |
| profile_facts.json | 53 | every fact row of every user in every status and version |
| profile_documents.json | 1 | the upload's row without the PDF bytes; their length and sha256 are recorded |
| users.json | 1 | the demo user |
| jobs.json | 107 | every job a packet cites, whole, posting text included |
| sources.json | 7 | the boards those jobs came from |
| matches.json | 101 | the user's score rows on those jobs |
| profiles.json | 2 | the fact sets the packets were built on, rebuilt from their rows and checked by facts hash, with the base resume and its shape hash |
| families-18sep-saved-answers.json | 80 | the 80 job sample's answers as `tailor-sample --save` wrote them: every attempt's change set, posting lemmas, attempt log and cost |
| meta.json | | counts read from the database by their own queries, a manifest with the sha256 of each file, what is absent, and the verification result; workingTreeClean is false there because the snapshot files themselves were untracked when it was taken |

## Profiles

| facts_hash | Row set | Packets |
|---|---|---|
| c9f231127f13 | the rows confirmed now: the uploaded resume's 24 facts plus the preference | 80, run families-18sep-changes |
| c70bf9c31851 | the preference plus the 24 rejected rows with no document, the seeded facts retired when the upload was confirmed | 27, run sample-2026-09-17-changes and the one product path packet |

Both hashes reproduce exactly from the rows, so no profile is reconstructed by guesswork.

## Absent, stated rather than reconstructed

- The PDF bytes of the upload. Its length and sha256 are in profile_documents.json.
- 120 job ids on cost rows of the two prefix scoring runs of 17 September and 20 cron scores have no jobs row. None of them is on a packet.
- One packet, 5800d1c7-a66c-4ff3-a681-c087b2b40909, carries a content hash its job no longer has: the posting text the model saw is not the stored one.
- The 74 packet versions replaced at 22:57 UTC. Not in the table, not in any export before this one, and unrecoverable: the 6 hour history window had expired before anyone read the console (D-030).
- The exact command lines of the seven 18 September runs. Not recorded anywhere.
- The code revision of the families-18sep run. By commit timestamps it ran fifteen seconds after a67c782 (#46) merged; the run's own revision was not recorded.
- Per attempt findings for the retried packets: the saved answers hold each attempt's change set and the attempt log, the packet row holds the retained attempt's findings only.
