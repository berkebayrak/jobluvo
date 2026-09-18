import { eq, sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { dbPool, endPool, type Tx } from "@/db/client";
import { jobs, packets, sources, users, type PacketFinding, type ResumeDocument } from "@/db/schema";
import { applyReplay, postingMoved, profileNotReproducible, replayDecision, sameDocument, summaryNotRevalidated, unreplayable, unverifiable, type ReplayRow } from "./replay";
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
  });

  it("keeps only the summary's old findings; bullet findings are the replay's", () => {
    const d = replayDecision(row({ status: "invalid", resume: null, resumeHash: null, findings: [bulletHard, summarySoft] }), [bulletHard], null);
    expect(d).toMatchObject({ kind: "restamp", status: "invalid", resume: null });
    expect(d.kind === "restamp" && d.findings).toEqual([bulletHard, summarySoft]);
  });

  it("names its coverage: a row with a change set is replayed whole and retains nothing, a legacy row with a summary is held on it, one without is fully covered", () => {
    // Full coverage: the summary's old findings are not retained; what the replay found over the whole change set is the row's findings.
    expect(replayDecision(row({ changeSet, findings: [summaryReview] }), [], doc)).toEqual({ kind: "restamp", status: "ready", findings: [], resume: doc, coverage: "full" });
    expect(replayDecision(row({ changeSet, findings: [] }), [summaryHard], doc)).toEqual({ kind: "restamp", status: "invalid", findings: [summaryHard], resume: null, coverage: "full" });
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

  it("does not replay a failed packet: an empty change set is no answer, not a clean one", () => {
    expect(replayDecision(row({ status: "failed", resume: null, resumeHash: null }), [], null)).toEqual({ kind: "no_candidate" });
  });

  it("does not promote a packet that passes today but has no resume stored", () => {
    const d = replayDecision(row({ status: "invalid", resume: null, resumeHash: null, findings: [bulletHard] }), [], null);
    expect(d).toEqual({ kind: "no_resume", would: "ready", findings: [], coverage: "bullets" });
  });

  it("revokes a ready or held row whose stored resume is not the base plus the stored changes, and cannot promote an invalid one", () => {
    // A ready row on a document nothing can verify: revoked, invalid, the resume dropped, a hard finding that says why.
    expect(replayDecision(row({ resume: drifted, changeSet }), [], doc)).toEqual({ kind: "revoke", status: "invalid", would: "ready", findings: [unverifiable()], resume: null, coverage: "full" });
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

  it("stamps invalid whatever the resume, and drops it", () => {
    expect(replayDecision(row({}), [bulletHard], doc)).toEqual({ kind: "restamp", status: "invalid", findings: [bulletHard, summaryNotRevalidated()], resume: null, coverage: "bullets" });
    expect(replayDecision(row({ changeSet }), [bulletHard], doc)).toEqual({ kind: "restamp", status: "invalid", findings: [bulletHard], resume: null, coverage: "full" });
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
      expect(result).toEqual({ restamped: 1, changedStatus: 1, revoked: 0, held: 0, stale: 0, untouched: 0 , rebuilt: 0 });
      const after = await read(tx, id);
      expect(after.status).toBe("invalid");
      expect(after.resume).toBeNull();
      expect(after.resumeHash).toBeNull();
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
      expect(result).toEqual({ restamped: 0, changedStatus: 0, revoked: 0, held: 0, stale: 1, untouched: 0 , rebuilt: 0 });
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
      expect(result).toEqual({ restamped: 1, changedStatus: 1, revoked: 1, held: 0, stale: 0, untouched: 0 , rebuilt: 0 });
      const after = await read(tx, id);
      // The assertion is on the gate, not on the decision: nothing downstream may consume this row.
      expect(consumableResume(after)).toBeNull();
      expect(after.status).toBe("invalid");
      expect(after.resume).toBeNull();
      expect(after.resumeHash).toBeNull();
      expect(after.findings).toEqual([summarySoft, summaryNotRevalidated(), unverifiable()]);
    });
  });

  it("holds a ready row no profile reproduces, keeps its resume, and the gate stops serving it", async () => {
    await withPacket(async (tx, id) => {
      const r = await read(tx, id);
      // Before: ready, and the gate serves the stored document on evidence nothing can check.
      expect(consumableResume(r)).toEqual(r.resume);
      const result = await applyReplay(tx, [{ row: r, decision: unreplayable(r, profileNotReproducible()) }]);
      expect(result).toEqual({ restamped: 1, changedStatus: 1, revoked: 0, held: 1, stale: 0, untouched: 0 , rebuilt: 0 });
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

  it("writes nothing for a decision that is not a restamp", async () => {
    await withPacket(async (tx, id) => {
      const r = await read(tx, id);
      const result = await applyReplay(tx, [
        { row: r, decision: { kind: "no_candidate" } },
        { row: r, decision: { kind: "no_resume", would: "ready", findings: [], coverage: "bullets" } },
      ]);
      expect(result).toEqual({ restamped: 0, changedStatus: 0, revoked: 0, held: 0, stale: 0, untouched: 2 , rebuilt: 0 });
      expect((await read(tx, id)).status).toBe("ready");
    });
  });
});
