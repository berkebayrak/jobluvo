import { eq, sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { dbPool, type Tx } from "@/db/client";
import { jobs, packets, sources, users, type PacketFinding, type ResumeDocument } from "@/db/schema";
import { applyReplay, replayDecision, sameDocument, type ReplayRow } from "./replay";
import { resumeHash } from "./resume";

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

/** The same document with its skills in another order, as a model that reordered them leaves it. */
const reordered: ResumeDocument = { ...doc, skills: [{ id: "S2", text: "Planning" }, { id: "S1", text: "Financial modelling" }] };
const docTwoSkills: ResumeDocument = { ...doc, skills: [{ id: "S1", text: "Financial modelling" }, { id: "S2", text: "Planning" }] };
/** A resume that is not the base plus the changes: a bullet the change set does not describe. */
const drifted: ResumeDocument = { ...doc, experience: [{ ...doc.experience[0], bullets: [{ id: "R1.1", text: "Cut cost 40 percent." }] }] };

const row = (over: Partial<ReplayRow>): ReplayRow => ({ id: "p", status: "ready", resume: doc, resumeHash: resumeHash(doc), findings: [], updatedAt: "t", ...over });

describe("replay decision", () => {
  it("derives the status from the retained summary findings as well as the replayed ones", () => {
    // Held by its summary only, bullets clean: stays held, resume kept.
    const held = replayDecision(row({ status: "needs_review", findings: [summaryReview] }), [], doc);
    expect(held).toMatchObject({ kind: "restamp", status: "needs_review", resume: doc });
    expect(held.kind === "restamp" && held.findings).toEqual([summaryReview]);
    // Rejected by its summary only: stays invalid, no resume.
    expect(replayDecision(row({ status: "invalid", resume: null, resumeHash: null, findings: [summaryHard] }), [], null)).toEqual({ kind: "restamp", status: "invalid", findings: [summaryHard], resume: null });
    // A soft summary finding travels and decides nothing.
    expect(replayDecision(row({ findings: [summarySoft] }), [], doc)).toMatchObject({ kind: "restamp", status: "ready", findings: [summarySoft], resume: doc });
  });

  it("keeps only the summary's old findings; bullet findings are the replay's", () => {
    const d = replayDecision(row({ status: "invalid", resume: null, resumeHash: null, findings: [bulletHard, summarySoft] }), [bulletHard], null);
    expect(d).toMatchObject({ kind: "restamp", status: "invalid", resume: null });
    expect(d.kind === "restamp" && d.findings).toEqual([bulletHard, summarySoft]);
  });

  it("does not replay a failed packet: an empty change set is no answer, not a clean one", () => {
    expect(replayDecision(row({ status: "failed", resume: null, resumeHash: null }), [], null)).toEqual({ kind: "no_candidate" });
  });

  it("does not promote a packet that passes today but has no resume stored", () => {
    const d = replayDecision(row({ status: "invalid", resume: null, resumeHash: null, findings: [bulletHard] }), [], null);
    expect(d).toEqual({ kind: "no_resume", would: "ready", findings: [] });
  });

  it("needs the stored resume to be the base plus the stored changes, up to skill order", () => {
    // The stored resume is not what the changes describe: no candidate.
    expect(replayDecision(row({ resume: drifted }), [], doc)).toMatchObject({ kind: "no_resume", would: "ready" });
    // The model reordered the skills and the change set does not carry that: still the candidate.
    expect(replayDecision(row({ resume: reordered }), [], docTwoSkills)).toMatchObject({ kind: "restamp", status: "ready", resume: reordered });
    expect(sameDocument(reordered, docTwoSkills)).toBe(true);
    expect(sameDocument(drifted, doc)).toBe(false);
  });

  it("stamps invalid whatever the resume, and drops it", () => {
    expect(replayDecision(row({}), [bulletHard], doc)).toEqual({ kind: "restamp", status: "invalid", findings: [bulletHard], resume: null });
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
    .select({ id: packets.id, status: packets.status, resume: packets.resume, resumeHash: packets.resumeHash, findings: packets.findings, updatedAt: sql<string>`${packets.updatedAt}::text` })
    .from(packets)
    .where(eq(packets.id, id));
  return r;
};

afterAll(async () => {
  const g = globalThis as unknown as { __jobluvoPool?: { end(): Promise<void> } };
  await g.__jobluvoPool?.end();
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
      expect(result).toEqual({ restamped: 1, changedStatus: 1, stale: 0, untouched: 0 });
      const after = await read(tx, id);
      expect(after.status).toBe("invalid");
      expect(after.resume).toBeNull();
      expect(after.resumeHash).toBeNull();
      expect(after.findings).toEqual([bulletHard, summarySoft]);
    });
  });

  it("refuses a row replaced between the read and the write, and leaves the newer row alone", async () => {
    await withPacket(async (tx, id) => {
      const r = await read(tx, id);
      // A new run lands on the same user and job after the report read it.
      await tx.update(packets).set({ status: "needs_review", findings: [summaryReview], updatedAt: sql`now() + interval '1 second'` }).where(eq(packets.id, id));
      const result = await applyReplay(tx, [{ row: r, decision: replayDecision(r, [bulletHard], doc) }]);
      expect(result).toEqual({ restamped: 0, changedStatus: 0, stale: 1, untouched: 0 });
      const after = await read(tx, id);
      expect(after.status).toBe("needs_review");
      expect(after.findings).toEqual([summaryReview]);
      expect(after.resume).toEqual(doc);
    });
  });

  it("writes nothing for a decision that is not a restamp", async () => {
    await withPacket(async (tx, id) => {
      const r = await read(tx, id);
      const result = await applyReplay(tx, [
        { row: r, decision: { kind: "no_candidate" } },
        { row: r, decision: { kind: "no_resume", would: "ready", findings: [] } },
      ]);
      expect(result).toEqual({ restamped: 0, changedStatus: 0, stale: 0, untouched: 2 });
      expect((await read(tx, id)).status).toBe("ready");
    });
  });
});
