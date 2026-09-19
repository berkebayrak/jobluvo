import { eq, sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { dbPool, endPool, type Tx } from "@/db/client";
import { jobs, packets, sources, users, type PacketFinding, type ResumeDocument } from "@/db/schema";
import { applyReplay, postingMoved, profileNotReproducible, replayDecision, sameDocument, summaryNotRevalidated, unreplayable, unverifiable, assessmentNotRun, hasCandidate, type ReplayDecision, type ReplayRow } from "./replay";
import { resumeHash } from "./resume";
import { consumableResume } from "./run";
import { VALIDATOR_REVISION } from "./validate";

/*
 * The replay decision, the five ways the first restamp went wrong, and
 * the write guard against the real database. Skipped without DATABASE_URL.
 */

const doc: ResumeDocument = {
  summary: "Strategy lead with a cost record.",
  experience: [{ id: "R1", heading: "Head of Strategy, Arvento", bullets: [{ id: "R1.1", text: "Cut cost 11 percent." }] }],
  education: [],
  skills: [{ id: "S1", text: "Financial modelling" }],
};

const summaryReview: PacketFinding = { level: "review", bullet: "summary", message: "name in no fact", value: "Salesforce" };
const summaryHard: PacketFinding = { level: "hard", bullet: "summary", message: "value in no cited fact", value: "40" };
const summarySoft: PacketFinding = { level: "soft", bullet: "summary", message: "name in no fact, sentence initial", value: "Owned", detail: "sentence initial" };
const bulletHard: PacketFinding = { level: "hard", bullet: "R1.1", message: "value in no cited fact", value: "six" };
const bulletReview: PacketFinding = { level: "review", bullet: "R1.1", message: "name appears in no confirmed fact", value: "KPI" };

/** The same document with its skills in another order, as a model that reordered them leaves it. */
const reordered: ResumeDocument = { ...doc, skills: [{ id: "S2", text: "Planning" }, { id: "S1", text: "Financial modelling" }] };
const docTwoSkills: ResumeDocument = { ...doc, skills: [{ id: "S1", text: "Financial modelling" }, { id: "S2", text: "Planning" }] };
/** A resume that is not the base plus the changes: a bullet the change set does not describe. */
const drifted: ResumeDocument = { ...doc, experience: [{ ...doc.experience[0], bullets: [{ id: "R1.1", text: "Cut cost 40 percent." }] }] };

const row = (over: Partial<ReplayRow>): ReplayRow => ({ id: "p", status: "ready", resume: doc, resumeHash: resumeHash(doc), findings: [], changeSet: null, updatedAt: "t", ...over });
const changeSet = { summary: doc.summary, summaryFacts: ["R1.1"], changes: [{ bullet: "R1.1", text: "Cut cost 11 percent.", facts: ["R1.1"] }], skills: ["S1"] };

describe("replay decision", () => {
  it("derives the status from the retained summary findings as well as the replayed ones", () => {
    // Held by its summary only, bullets clean: stays held, resume kept; a legacy row with a summary also carries the coverage finding.
    const held = replayDecision(row({ status: "needs_review", findings: [summaryReview] }), [], doc);
    expect(held).toMatchObject({ kind: "restamp", status: "needs_review", resume: doc, coverage: "bullets" });
    expect(held.kind === "restamp" && held.findings).toEqual([summaryReview, summaryNotRevalidated()]);
    // Rejected by its summary only: stays invalid, no resume.
    expect(replayDecision(row({ status: "invalid", resume: null, resumeHash: null, findings: [summaryHard] }), [], null)).toEqual({ kind: "restamp", status: "invalid", findings: [summaryHard], resume: null, coverage: "bullets" });
    // A soft summary finding travels and decides nothing; the legacy summary itself holds the row, since the replay could not read it again.
    expect(replayDecision(row({ findings: [summarySoft] }), [], doc)).toMatchObject({ kind: "restamp", status: "needs_review", findings: [summarySoft, summaryNotRevalidated()], resume: doc });
  });

  /*
   * D-037. A rejection clears the stored resume. When the rule that rejected the row is
   * later withdrawn, the row passes again and there is nothing to promote, which is how a
   * day of a wrong rule destroyed ten packets on 18 September 2026. A row that stores the
   * change set it was built from can be rebuilt: base plus that change set is
   * deterministic and both are on the row. That is reconstruction, not promotion on
   * evidence nothing can check, and the difference is the change set.
   */
  it("rebuilds a rejected row's cleared resume from its own stored change set, and stamps what the validator says now", () => {
    const rejected = row({ status: "invalid", resume: null, resumeHash: null, findings: [bulletHard], changeSet });
    // The rule that rejected it is gone, so the replay finds nothing: the row comes back on the rebuilt candidate.
    const d = replayDecision(rejected, [], doc);
    expect(d).toEqual({ kind: "rebuild", status: "ready", findings: [], resume: doc, coverage: "full" });
  });

  it("rebuilds to whatever the validator says, never to ready by default", () => {
    const rejected = row({ status: "invalid", resume: null, resumeHash: null, findings: [bulletHard], changeSet });
    // Still held by a finding of its own: it comes back held, with its resume, not ready.
    expect(replayDecision(rejected, [bulletReview], doc)).toEqual({ kind: "rebuild", status: "needs_review", findings: [bulletReview], resume: doc, coverage: "full" });
    // Still rejected: no rebuild at all, and no resume.
    expect(replayDecision(rejected, [bulletHard], null)).toEqual({ kind: "restamp", status: "invalid", findings: [bulletHard], resume: null, coverage: "full" });
  });

  it("leaves a rejected row with no stored change set exactly as it is, because nothing can rebuild it", () => {
    // The honest cost of the rule that deleted the evidence: a legacy row cannot be reconstructed and stays invalid.
    const legacy = row({ status: "invalid", resume: null, resumeHash: null, findings: [bulletHard] });
    // "would: ready" is the sting: it passes today and there is no document left to give anybody.
    expect(replayDecision(legacy, [], null)).toMatchObject({ kind: "no_resume", would: "ready" });
    // Unless a document is offered from outside and the row's own changes reproduce it, which is the next test.
  });

  /*
   * D-043. Four of the six rows D-037 left invalid have their document in a frozen snapshot that is in version
   * control. The row said it had none, and it did. Restoring it is a repair and not a promotion: the offered
   * document is accepted only where the row's own stored changes reproduce it, the validator then reads it under
   * the rules as they stand, and whatever that says is the status.
   */
  const noSummary = { ...doc, summary: null };
  const offered = { document: noSummary, source: "design/snapshots/2026-09-18-packets/packets.json", hash: "abc123" };

  it("restores a document offered from outside when the row's own stored changes reproduce it, and names the source on the row", () => {
    const legacy = row({ status: "invalid", resume: null, resumeHash: null, findings: [bulletHard] });
    const d = replayDecision(legacy, [], noSummary, [], offered);
    expect(d.kind).toBe("repair");
    expect(d.kind === "repair" && d.status).toBe("ready");
    expect(d.kind === "repair" && d.resume).toEqual(noSummary);
    expect(d.kind === "repair" && d.source).toBe(offered.source);
    // The source is on the row, as provenance rather than as a complaint: soft, so it does not hold anything.
    const f = d.kind === "repair" ? d.findings.find((x) => x.code === "resume-repaired")! : null;
    expect(f?.level).toBe("soft");
    expect(f?.value).toBe(offered.source);
    expect(f?.detail).toContain("abc123");
  });

  it("refuses a document the row's own stored changes do not reproduce, however good the source", () => {
    const legacy = row({ status: "invalid", resume: null, resumeHash: null, findings: [bulletHard] });
    // The candidate built from the row's changes is `doc`; the offered document is a different one.
    const wrong = { ...offered, document: drifted };
    expect(replayDecision(legacy, [], noSummary, [], wrong)).toMatchObject({ kind: "no_resume", would: "ready" });
    // And a row with no candidate at all cannot verify anything, so nothing is restored to it either.
    expect(replayDecision(legacy, [], null, [], offered)).toMatchObject({ kind: "no_resume", would: "ready" });
  });

  it("stamps a repaired row on what the validator says, never on the fact that it was repaired", () => {
    const legacy = row({ status: "invalid", resume: null, resumeHash: null, findings: [bulletHard] });
    // Still held by a finding of its own: it comes back held, with its document.
    expect(replayDecision(legacy, [bulletReview], noSummary, [], offered)).toMatchObject({ kind: "repair", status: "needs_review" });
    // Still rejected: the document is attached anyway, because a rejection blocks a document and does not decide
    // whether one exists (D-038), and an invalid row with a document is not a promotion.
    const rejected = replayDecision(legacy, [bulletHard], noSummary, [], offered);
    expect(rejected).toMatchObject({ kind: "repair", status: "invalid" });
    expect(rejected.kind === "repair" && rejected.resume).toEqual(noSummary);
  });

  it("holds a repaired row on a summary nothing revalidated, exactly as any other row with no change set", () => {
    // The offered document supplies the summary, and nothing supplies the facts it cited, so the summary is not
    // revalidated and the row is held on that. A restored summary is never stamped as read when nothing read it.
    const legacy = row({ status: "invalid", resume: null, resumeHash: null, findings: [] });
    const d = replayDecision(legacy, [], doc, [], { ...offered, document: doc });
    expect(d).toMatchObject({ kind: "repair", status: "needs_review", coverage: "bullets" });
    expect(d.kind === "repair" && d.findings.map((f) => f.code)).toContain("summary-not-revalidated");
  });

  it("offers nothing to a row that already has a document, or one that can rebuild itself", () => {
    // A row with its own resume is on the ordinary path; the offer is not consulted.
    expect(replayDecision(row({}), [], doc, [], offered)).toMatchObject({ kind: "restamp" });
    // A row with a change set rebuilds from itself, which is stronger evidence than an outside file.
    const rebuildable = row({ status: "invalid", resume: null, resumeHash: null, findings: [bulletHard], changeSet });
    expect(replayDecision(rebuildable, [], doc, [], offered)).toMatchObject({ kind: "rebuild" });
  });

  it("keeps only the summary's old findings; bullet findings are the replay's", () => {
    const d = replayDecision(row({ status: "invalid", resume: null, resumeHash: null, findings: [bulletHard, summarySoft] }), [bulletHard], null);
    expect(d).toMatchObject({ kind: "restamp", status: "invalid", resume: null });
    expect(d.kind === "restamp" && d.findings).toEqual([bulletHard, summarySoft]);
  });

  it("names its coverage: a row with a change set is replayed whole and retains nothing, a legacy row with a summary is held on it, one without is fully covered", () => {
    // Full coverage: the summary's old findings are not retained; what the replay found over the whole change set is the row's findings.
    expect(replayDecision(row({ changeSet, findings: [summaryReview] }), [], doc)).toEqual({ kind: "restamp", status: "ready", findings: [], resume: doc, coverage: "full" });
    expect(replayDecision(row({ changeSet, findings: [] }), [summaryHard], doc)).toEqual({ kind: "restamp", status: "invalid", findings: [summaryHard], resume: doc, coverage: "full" });
    // Bullets only, with a summary: cannot be stamped ready, held with the finding that says why, the old summary findings kept.
    expect(replayDecision(row({ findings: [summarySoft] }), [], doc)).toEqual({
      kind: "restamp",
      status: "needs_review",
      findings: [summarySoft, summaryNotRevalidated()],
      resume: doc,
      coverage: "bullets",
    });
    // Bullets only, no summary: nothing was left unread.
    const noSummary = { ...doc, summary: null };
    expect(replayDecision(row({ resume: noSummary, resumeHash: resumeHash(noSummary) }), [], noSummary)).toEqual({ kind: "restamp", status: "ready", findings: [], resume: noSummary, coverage: "bullets" });
  });

  /*
   * D-049, the eighth review's finding 3. A ready row with NO resume and a full change set was revoked to invalid
   * on one pass and rebuilt to ready on the next, over identical inputs: the revoke is guarded on the row being
   * ready or held, so once it was invalid the next pass fell past the revoke into the rebuild. The hard finding
   * that revoked it went with it, because a replay retains only summary findings.
   *
   * The seventh review named two cases, a MISSING resume and a MISMATCHED one, and the rebuttal that closed the
   * finding checked only the mismatched one. These cover both, and the last one covers every shape, because the
   * property that was missing is not about a case at all: it is that reading a row twice says the same thing.
   */
  it("rebuilds a ready row that has no resume, rather than revoking it and rebuilding it on the next pass", () => {
    const missing = row({ status: "ready", resume: null, resumeHash: null, findings: [], changeSet });
    const d = replayDecision(missing, [], doc);
    expect(d).toEqual({ kind: "rebuild", status: "ready", findings: [], resume: doc, coverage: "full" });
    // The old order gave revoke here, and a rebuild to ready on the pass after it.
    expect(d.kind).not.toBe("revoke");
  });

  it("still revokes a ready row with no resume that cannot rebuild itself", () => {
    // Bullets only: no change set, so there is nothing to rebuild from and the revoke is the right answer.
    const legacy = row({ status: "ready", resume: null, resumeHash: null, findings: [] });
    expect(replayDecision(legacy, [], null)).toMatchObject({ kind: "revoke", status: "invalid" });
  });

  it("says the same thing about a row however many times it is read, findings included", () => {
    /*
     * The general property. Each shape is read three times, feeding each decision back onto the row, and
     * everything the row carries must settle on the first pass and stay there.
     *
     * **Everything, not the status.** The ninth review's finding 6: this compared the status and whether a
     * document was present, and D-049 recorded it as asserting that reading a row twice says the same thing. It
     * did not assert that. `summaryNotRevalidated` carries bullet "summary", `retainedFindings` keeps everything
     * with that bullet, and a fresh copy is appended on top, so a legacy row with a summary gained one copy per
     * pass while all three passes agreed on the status and passed the test.
     */
    const apply = (r: ReplayRow, d: ReplayDecision): ReplayRow =>
      d.kind === "no_resume" || d.kind === "no_candidate"
        ? r
        : { ...r, status: d.status, resume: "resume" in d ? (d.resume as ResumeDocument | null) : r.resume, findings: "findings" in d ? d.findings : r.findings };
    const state = (r: ReplayRow) => JSON.stringify({ status: r.status, resume: r.resume, findings: r.findings });
    const shapes: [string, ReplayRow, ResumeDocument | null][] = [
      ["ready, no resume, full change set", row({ status: "ready", resume: null, resumeHash: null, findings: [], changeSet }), doc],
      ["ready, no resume, bullets only", row({ status: "ready", resume: null, resumeHash: null, findings: [] }), null],
      ["ready, mismatched resume", row({ resume: drifted, changeSet }), doc],
      ["invalid, no resume, full change set", row({ status: "invalid", resume: null, resumeHash: null, findings: [], changeSet }), doc],
      ["ready, resume matches", row({ changeSet }), doc],
      ["failed, parsed candidate never assessed", row({ status: "failed", resume: doc, findings: [], changeSet }), doc],
      // The shape the old assertions could not see, and the one 27 stored rows are in: no change set, a summary
      // the replay cannot read again, and a summary finding of its own that must survive every pass exactly once.
      ["ready, bullets only, with a summary", row({ findings: [summaryReview] }), doc],
      ["held, bullets only, with a summary and a soft finding", row({ status: "needs_review", findings: [summarySoft, summaryReview] }), doc],
    ];
    for (const [name, start, candidate] of shapes) {
      const first = apply(start, replayDecision(start, [], candidate));
      const second = apply(first, replayDecision(first, [], candidate));
      const third = apply(second, replayDecision(second, [], candidate));
      expect(`${name}: ${state(second)}`).toBe(`${name}: ${state(first)}`);
      expect(`${name}: ${state(third)}`).toBe(`${name}: ${state(first)}`);
    }
  });

  it("derives the coverage finding again on every pass rather than retaining the last pass's copy", () => {
    // The mechanism behind the shape above, asserted directly so a failure says what broke. The derived finding
    // is the replay's own and is never carried forward as though the run had written it; the row's genuine
    // summary findings are, which is the half a filter by code would have got wrong.
    const legacy = row({ findings: [summaryReview] });
    const once = replayDecision(legacy, [], doc);
    const carried = once.kind === "restamp" ? once.findings : [];
    expect(carried.filter((f) => f.code === "summary-not-revalidated")).toHaveLength(1);
    const twice = replayDecision({ ...legacy, findings: carried }, [], doc);
    expect(twice.kind === "restamp" && twice.findings.filter((f) => f.code === "summary-not-revalidated")).toHaveLength(1);
    // And the row's own summary finding is still there, once, on both passes.
    expect(twice.kind === "restamp" && twice.findings.filter((f) => f.message === summaryReview.message)).toHaveLength(1);
  });

  /*
   * D-050, the eighth review's finding 4. D-045 keeps the document when the validator throws on an answer that
   * parsed, and the replay skipped every `failed` row on the assumption that failed means no candidate. So the
   * document D-045 paid to keep could never be read again: fixing the validator and restamping would not reach it.
   *
   * The two failures are different things. A call that never returned, or an answer that never parsed, has nothing
   * to read. A parsed candidate whose assessment failed has a document and no verdict on it.
   */
  it("reads a parsed candidate whose assessment failed, instead of skipping it with the executions that produced nothing", () => {
    const assessed = row({ status: "failed", resume: doc, findings: [], changeSet });
    expect(hasCandidate(assessed)).toBe(true);
    const d = replayDecision(assessed, [], doc);
    expect(d.kind).toBe("restamp");
    // Held, never promoted: the row records an execution that failed and a person decides, not a report.
    expect(d.kind === "restamp" && d.status).toBe("needs_review");
    expect(d.kind === "restamp" && d.findings.map((f) => f.code)).toContain("assessment-not-run");
    expect(d.kind === "restamp" && d.resume).toEqual(doc);
  });

  it("still skips a failed execution that produced no answer", () => {
    expect(hasCandidate(row({ status: "failed", resume: null, resumeHash: null, changeSet: null }))).toBe(false);
    expect(replayDecision(row({ status: "failed", resume: null, resumeHash: null, findings: [], changeSet: null }), [], null)).toEqual({ kind: "no_candidate" });
  });

  it("actually validates the kept document rather than reading its empty findings as a pass", () => {
    // The stored findings of such a row are empty because nothing ever read it, not because it passed. What the
    // validator says today is what decides, and a hard finding rejects the row exactly as it would any other.
    //
    // **What this covers, said plainly** (the ninth review's note on it). The hard finding is injected, so this
    // asserts that `replayDecision` uses the findings it is handed. It does not assert that anything reaches a
    // failed row and hands it any. The write guard suite below has that path end to end, against the database.
    const assessed = row({ status: "failed", resume: doc, findings: [], changeSet });
    const d = replayDecision(assessed, [bulletHard], doc);
    expect(d).toMatchObject({ kind: "restamp", status: "invalid" });
    // The hard finding is the validator's, read today over the stored change set, not anything the row carried.
    expect(d.kind === "restamp" && d.findings).toContainEqual(bulletHard);
  });

  it("keeps holding such a row on every later pass, rather than clearing the reason and stamping it ready", () => {
    // The sticky half. Without it this is D-049's defect again: hold on pass one, finding not retained, ready on
    // pass two. The finding is re-derived from the row's own findings, so the row stays held until a person acts.
    const held = row({ status: "needs_review", resume: doc, findings: [assessmentNotRun()], changeSet });
    const d = replayDecision(held, [], doc);
    expect(d).toMatchObject({ kind: "restamp", status: "needs_review" });
    expect(d.kind === "restamp" && d.findings.map((f) => f.code)).toEqual(["assessment-not-run"]);
  });

  it("does not replay a failed packet: an empty change set is no answer, not a clean one", () => {
    expect(replayDecision(row({ status: "failed", resume: null, resumeHash: null }), [], null)).toEqual({ kind: "no_candidate" });
  });

  it("does not promote a packet that passes today but has no resume stored", () => {
    const d = replayDecision(row({ status: "invalid", resume: null, resumeHash: null, findings: [bulletHard] }), [], null);
    expect(d).toEqual({ kind: "no_resume", would: "ready", findings: [], coverage: "bullets" });
  });

  it("revokes a ready or held row whose stored resume is not the base plus the stored changes, and cannot promote an invalid one", () => {
    // A ready row on a document nothing can verify: revoked, invalid, a hard finding that says why. The document it
    // could not verify is kept rather than deleted (D-038); the status is what stops it being served.
    expect(replayDecision(row({ resume: drifted, changeSet }), [], doc)).toEqual({ kind: "revoke", status: "invalid", would: "ready", findings: [unverifiable()], resume: drifted, coverage: "full" });
    // A held row with no resume at all: the same.
    expect(replayDecision(row({ status: "needs_review", resume: null, resumeHash: null, findings: [summaryReview] }), [], null)).toEqual({
      kind: "revoke",
      status: "invalid",
      would: "needs_review",
      findings: [summaryReview, unverifiable()],
      resume: null,
      coverage: "bullets",
    });
    // An invalid row that would pass today has nothing to revoke and nothing to promote.
    expect(replayDecision(row({ status: "invalid", resume: null, resumeHash: null, findings: [bulletHard] }), [], null)).toEqual({ kind: "no_resume", would: "ready", findings: [], coverage: "bullets" });
  });

  it("needs the stored resume to be the base plus the stored changes, up to skill order", () => {
    // The stored resume is not what the changes describe: no candidate to restamp.
    expect(replayDecision(row({ resume: drifted }), [], doc).kind).toBe("revoke");
    // The model reordered the skills and a legacy change set does not carry that: still the candidate. No summary, so fully covered.
    const reorderedNoSummary = { ...reordered, summary: null };
    expect(replayDecision(row({ resume: reorderedNoSummary }), [], { ...docTwoSkills, summary: null })).toMatchObject({ kind: "restamp", status: "ready", resume: reorderedNoSummary });
    expect(sameDocument(reordered, docTwoSkills)).toBe(true);
    expect(sameDocument(drifted, doc)).toBe(false);
  });

  it("stamps invalid whatever the resume, and keeps the document it rejected", () => {
    // D-038: a rejection blocks the document, it does not delete it. Clearing it here is what left the demotion of
    // D-036 with nothing to promote a day later.
    expect(replayDecision(row({}), [bulletHard], doc)).toEqual({ kind: "restamp", status: "invalid", findings: [bulletHard, summaryNotRevalidated()], resume: doc, coverage: "bullets" });
    expect(replayDecision(row({ changeSet }), [bulletHard], doc)).toEqual({ kind: "restamp", status: "invalid", findings: [bulletHard], resume: doc, coverage: "full" });
    // A row that had no document to begin with still has none: nothing is invented.
    expect(replayDecision(row({ status: "invalid", resume: null, resumeHash: null, findings: [bulletHard] }), [bulletHard], null)).toEqual({ kind: "restamp", status: "invalid", findings: [bulletHard], resume: null, coverage: "bullets" });
  });
});

const hasDb = !!process.env.DATABASE_URL;
class Rollback extends Error {}

async function withPacket(fn: (tx: Tx, id: string) => Promise<void>) {
  await dbPool()
    .transaction(async (tx) => {
      const stamp = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const [user] = await tx
        .insert(users)
        .values({ name: "Replay fixture", email: `replay-${stamp}@test.invalid`, jobluvoAddress: `replay-${stamp}@test.invalid` })
        .returning({ id: users.id });
      const [src] = await tx
        .insert(sources)
        .values({ family: "greenhouse", tenant: `replay-test-${stamp}`, companyName: "Fixture Co", companyDomain: null })
        .returning({ id: sources.id });
      const [job] = await tx
        .insert(jobs)
        .values({
          sourceId: src.id,
          family: "greenhouse",
          nativeId: "j",
          title: "Strategy Lead",
          titleNorm: "strategy lead",
          companyName: "Fixture Co",
          locations: [{ raw: "Nowhere", country: "ZZ" }],
          workplace: "onsite",
          descriptionText: "Own planning.",
          descriptionHtml: "<p>Own planning.</p>",
          descriptionCore: "Own planning.",
          contentHash: `hash-${stamp}`,
          applyUrl: `https://example.com/${stamp}`,
          applyUrlNorm: `https://example.com/${stamp}`,
        })
        .returning({ id: jobs.id });
      const [p] = await tx
        .insert(packets)
        .values({ userId: user.id, jobId: job.id, status: "ready", mode: "changes", model: "test", resume: doc, resumeHash: resumeHash(doc), findings: [summarySoft], factsHash: "f", contentHash: `hash-${stamp}` })
        .returning({ id: packets.id });
      await fn(tx, p.id);
      throw new Rollback();
    })
    .catch((e) => {
      if (!(e instanceof Rollback)) throw e;
    });
}

const read = async (tx: Tx, id: string): Promise<ReplayRow> => {
  const [r] = await tx
    .select({ id: packets.id, status: packets.status, resume: packets.resume, resumeHash: packets.resumeHash, findings: packets.findings, changeSet: packets.changeSet, updatedAt: sql<string>`${packets.updatedAt}::text` })
    .from(packets)
    .where(eq(packets.id, id));
  return r;
};

afterAll(async () => {
  await endPool();
});

describe.skipIf(!hasDb)("replay write guard", () => {
  beforeAll(async () => {
    await dbPool().execute(sql`select 1`);
  });

  it("restamps a row that has not moved, and counts the status change", async () => {
    await withPacket(async (tx, id) => {
      const r = await read(tx, id);
      // The row came back from jsonb with its keys in the database's order; the hash still names the document.
      expect(resumeHash(r.resume!)).toBe(r.resumeHash);
      expect(Object.keys(r.resume!)).not.toEqual(Object.keys(doc));
      const result = await applyReplay(tx, [{ row: r, decision: replayDecision(r, [bulletHard], doc) }]);
      expect(result).toEqual({ restamped: 1, changedStatus: 1, revoked: 0, held: 0, stale: 0, untouched: 0, rebuilt: 0, repaired: 0 });
      const after = await read(tx, id);
      expect(after.status).toBe("invalid");
      // The rejection blocks the document and keeps it: the gate is the status, not the absence of a resume (D-038).
      expect(after.resume).toEqual(r.resume);
      expect(after.resumeHash).toBe(r.resumeHash);
      expect(consumableResume(after)).toBeNull();
      expect(after.findings).toEqual([bulletHard, summarySoft, summaryNotRevalidated()]);
      const [stamped] = await tx.select({ validatorRev: packets.validatorRev }).from(packets).where(eq(packets.id, id));
      expect(stamped.validatorRev).toBe(VALIDATOR_REVISION);
    });
  });

  it("refuses a row replaced between the read and the write, and leaves the newer row alone", async () => {
    await withPacket(async (tx, id) => {
      const r = await read(tx, id);
      // A new run lands on the same user and job after the report read it.
      await tx.update(packets).set({ status: "needs_review", findings: [summaryReview], updatedAt: sql`now() + interval '1 second'` }).where(eq(packets.id, id));
      const result = await applyReplay(tx, [{ row: r, decision: replayDecision(r, [bulletHard], doc) }]);
      expect(result).toEqual({ restamped: 0, changedStatus: 0, revoked: 0, held: 0, stale: 1, untouched: 0, rebuilt: 0, repaired: 0 });
      const after = await read(tx, id);
      expect(after.status).toBe("needs_review");
      expect(after.findings).toEqual([summaryReview]);
      expect(after.resume).toEqual(doc);
    });
  });

  it("revokes a ready row whose stored resume cannot be verified, and the gate stops serving it", async () => {
    await withPacket(async (tx, id) => {
      const r = await read(tx, id);
      // Before: ready, and the gate serves the stored document.
      expect(consumableResume(r)).toEqual(r.resume);
      // The base plus the stored changes is not the stored resume: the candidate is a different document.
      const result = await applyReplay(tx, [{ row: r, decision: replayDecision(r, [], drifted) }]);
      expect(result).toEqual({ restamped: 1, changedStatus: 1, revoked: 1, held: 0, stale: 0, untouched: 0, rebuilt: 0, repaired: 0 });
      const after = await read(tx, id);
      // The assertion is on the gate, not on the decision: nothing downstream may consume this row.
      expect(consumableResume(after)).toBeNull();
      expect(after.status).toBe("invalid");
      // The document nothing could verify is kept, not deleted. It may be perfectly good; what is missing is the
      // evidence to say so, and deleting it answers nothing (D-038).
      expect(after.resume).toEqual(r.resume);
      expect(after.resumeHash).toBe(r.resumeHash);
      expect(after.findings).toEqual([summarySoft, summaryNotRevalidated(), unverifiable()]);
    });
  });

  it("holds a ready row no profile reproduces, keeps its resume, and the gate stops serving it", async () => {
    await withPacket(async (tx, id) => {
      const r = await read(tx, id);
      // Before: ready, and the gate serves the stored document on evidence nothing can check.
      expect(consumableResume(r)).toEqual(r.resume);
      const result = await applyReplay(tx, [{ row: r, decision: unreplayable(r, profileNotReproducible()) }]);
      expect(result).toEqual({ restamped: 1, changedStatus: 1, revoked: 0, held: 1, stale: 0, untouched: 0, rebuilt: 0, repaired: 0 });
      const after = await read(tx, id);
      // The assertion is on the gate: nothing downstream may consume this row.
      expect(consumableResume(after)).toBeNull();
      expect(after.status).toBe("needs_review");
      // Held, not destroyed: the document may be perfectly good and what is missing is the evidence to say so.
      expect(after.resume).toEqual(r.resume);
      expect(after.findings.map((f) => f.code)).toContain("profile-not-reproducible");
    });
  });

  it("holds a ready row whose posting has moved, so a stamp is never made from a different question", async () => {
    await withPacket(async (tx, id) => {
      const r = await read(tx, id);
      // The replay itself finds nothing wrong; the input it read is not the one the model was given.
      const decision = replayDecision(r, [], r.resume, [postingMoved()]);
      expect(decision.kind).toBe("restamp");
      expect(decision.kind === "restamp" && decision.status).toBe("needs_review");
      const result = await applyReplay(tx, [{ row: r, decision }]);
      expect(result.restamped).toBe(1);
      const after = await read(tx, id);
      expect(consumableResume(after)).toBeNull();
      expect(after.findings.map((f) => f.code)).toContain("posting-moved");
    });
  });

  it("leaves a failed or invalid row alone when nothing can revalidate it, since neither is consumable", async () => {
    await withPacket(async (tx, id) => {
      const r = await read(tx, id);
      for (const status of ["failed", "invalid"]) {
        expect(unreplayable({ ...r, status }, profileNotReproducible())).toEqual({ kind: "no_candidate" });
      }
      // And a repeated hold does not stack the same reason twice.
      const once = unreplayable(r, profileNotReproducible());
      const twice = unreplayable({ ...r, findings: once.kind === "hold" ? once.findings : [] }, profileNotReproducible());
      expect(twice.kind === "hold" && twice.findings.filter((f) => f.code === "profile-not-reproducible")).toHaveLength(1);
      expect((await read(tx, id)).status).toBe("ready");
    });
  });

  it("reaches a failed row that kept a parsed document, validates it and writes the hold", async () => {
    /*
     * The integration half of D-050, from the ninth review's note on finding 7. The unit test asserts that
     * `replayDecision` uses the findings it is handed; this asserts that a failed row with a document goes
     * through the real write and comes back held, with its document and off the consumable path.
     *
     * The one step still not asserted here is the report's own select, which reads every packet with no status
     * filter (`scripts/validator-report.ts`). That is read rather than tested, and this covers everything after
     * it. Saying which part is covered is the point of the note.
     */
    await withPacket(async (tx, id) => {
      await tx.update(packets).set({ status: "failed", findings: [], changeSet, updatedAt: sql`now()` }).where(eq(packets.id, id));
      const r = await read(tx, id);
      expect(r.status).toBe("failed");
      expect(hasCandidate(r)).toBe(true);
      const result = await applyReplay(tx, [{ row: r, decision: replayDecision(r, [], doc) }]);
      expect(result.restamped).toBe(1);
      const after = await read(tx, id);
      // Held, never promoted, and the document D-045 paid to keep is still there and still not servable.
      expect(after.status).toBe("needs_review");
      expect(after.resume).toEqual(r.resume);
      expect(consumableResume(after)).toBeNull();
      expect(after.findings.map((f) => f.code)).toContain("assessment-not-run");
    });
  });

  it("writes nothing for a decision that is not a restamp", async () => {
    await withPacket(async (tx, id) => {
      const r = await read(tx, id);
      const result = await applyReplay(tx, [
        { row: r, decision: { kind: "no_candidate" } },
        { row: r, decision: { kind: "no_resume", would: "ready", findings: [], coverage: "bullets" } },
      ]);
      expect(result).toEqual({ restamped: 0, changedStatus: 0, revoked: 0, held: 0, stale: 0, untouched: 2, rebuilt: 0, repaired: 0 });
      expect((await read(tx, id)).status).toBe("ready");
    });
  });
});
