import { describe, expect, it } from "vitest";
import type { PacketFinding, ResumeDocument } from "@/db/schema";
import type { ChangeSet } from "./resume";
import { classifyRetry, describeRetry, mergeRetry, objectedTo, retryFinding } from "./retry";

/*
 * Finding 14. A retry may replace a line the validator objected to and may
 * not delete one it did not. The classification says which happened, and the
 * merge puts back only the lines the validator had no complaint about.
 */

const BASE: ResumeDocument = {
  summary: null,
  experience: [
    {
      id: "R1",
      heading: "Head of Strategy, Arvento",
      bullets: [
        { id: "R1.1", text: "Ran a 3 year cost program that cut cost 11 percent." },
        { id: "R1.2", text: "Own the annual planning cycle." },
        { id: "R1.3", text: "Report to the CEO." },
      ],
    },
  ],
  education: [],
  skills: [
    { id: "S1", text: "Strategy" },
    { id: "S2", text: "SQL" },
  ],
};

const cs = (changes: { bullet: string; text: string }[], summary: string | null = null, skills: string[] = []): ChangeSet => ({
  summary,
  summaryFacts: summary ? ["R1"] : [],
  changes: changes.map((c) => ({ ...c, facts: [c.bullet] })),
  skills,
});

const hard = (bullet: string): PacketFinding => ({ level: "hard", bullet, message: "value does not mean what the fact means" });
const soft = (bullet: string): PacketFinding => ({ level: "soft", bullet, message: "value is from a line you typed, not the resume's words" });

describe("what a retry did to the answer before it", () => {
  const first = cs([
    { bullet: "R1.1", text: "Led a 3 year cost program that cut cost 14 percent." },
    { bullet: "R1.2", text: "Own the annual planning cycle end to end." },
    { bullet: "R1.3", text: "Report directly to the CEO." },
  ]);

  it("names the dropped lines and separates the ones the validator objected to", () => {
    // The retry fixes the flagged line and returns nothing else.
    const retry = cs([{ bullet: "R1.1", text: "Led a 3 year cost program that cut cost 11 percent." }]);
    const c = classifyRetry(BASE, first, retry, [hard("R1.1")]);
    expect(c.kind).toBe("dropped edited lines");
    expect(c.of).toBe(3);
    expect(c.dropped.sort()).toEqual(["R1.2", "R1.3"]);
    // R1.1 was objected to and is not a dropped line at all here; the two dropped ones were never complained about.
    expect(c.clean.sort()).toEqual(["R1.2", "R1.3"]);
  });

  it("does not count a line the validator objected to as clean, so a rejected line is never put back", () => {
    const retry = cs([{ bullet: "R1.1", text: "Led a 3 year cost program that cut cost 11 percent." }]);
    const c = classifyRetry(BASE, first, retry, [hard("R1.1"), hard("R1.3")]);
    expect(c.dropped.sort()).toEqual(["R1.2", "R1.3"]);
    expect(c.clean).toEqual(["R1.2"]);
    const merged = mergeRetry(first, retry, c);
    expect(merged.changes.map((x) => x.bullet).sort()).toEqual(["R1.1", "R1.2"]);
    // The invention the retry was asked to remove does not come back.
    expect(merged.changes.some((x) => x.bullet === "R1.3")).toBe(false);
  });

  it("treats a soft finding as no objection, because a soft finding does not hold a line", () => {
    expect(objectedTo([soft("R1.2"), hard("R1.1")])).toEqual(new Set(["R1.1"]));
  });

  it("keeps the retry's own text where both answers edited the same line", () => {
    const retry = cs([
      { bullet: "R1.1", text: "Led a 3 year cost program that cut cost 11 percent." },
      { bullet: "R1.2", text: "Own the planning cycle." },
    ]);
    const c = classifyRetry(BASE, first, retry, [hard("R1.1")]);
    const merged = mergeRetry(first, retry, c);
    expect(merged.changes.find((x) => x.bullet === "R1.2")!.text).toBe("Own the planning cycle.");
    expect(merged.changes.find((x) => x.bullet === "R1.3")!.text).toBe("Report directly to the CEO.");
  });

  it("names a retry that kept every line, and merges nothing", () => {
    const retry = cs([
      { bullet: "R1.1", text: "Led a 3 year cost program that cut cost 11 percent." },
      { bullet: "R1.2", text: "Own the annual planning cycle end to end." },
      { bullet: "R1.3", text: "Report directly to the CEO." },
    ]);
    const c = classifyRetry(BASE, first, retry, [hard("R1.1")]);
    expect(c.kind).toBe("kept every edited line, substituted");
    expect(mergeRetry(first, retry, c)).toBe(retry);
  });

  it("names a retry that edited more, and one that edited a different set", () => {
    const more = cs([
      { bullet: "R1.1", text: "Led a 3 year cost program that cut cost 11 percent." },
      { bullet: "R1.2", text: "Own the annual planning cycle end to end." },
      { bullet: "R1.3", text: "Report directly to the CEO." },
    ]);
    expect(classifyRetry(BASE, cs([{ bullet: "R1.1", text: "Led a 3 year cost program that cut cost 14 percent." }]), more, [hard("R1.1")]).kind).toBe("kept every edited line and edited more");
    // A different set means it dropped lines the first answer edited and edited one the first answer did not touch.
    const firstTwo = cs([
      { bullet: "R1.1", text: "Led a 3 year cost program that cut cost 14 percent." },
      { bullet: "R1.2", text: "Own the annual planning cycle end to end." },
    ]);
    const different = cs([{ bullet: "R1.3", text: "Report directly to the CEO." }]);
    const c = classifyRetry(BASE, firstTwo, different, [hard("R1.1")]);
    expect(c.kind).toBe("edited a different set of lines");
    expect(c.dropped.sort()).toEqual(["R1.1", "R1.2"]);
    expect(c.clean).toEqual(["R1.2"]);
    expect(describeRetry(c)).toBe("the retry edited a different set of lines and dropped 2 of 2 edited lines; 1 line the validator had not objected to was put back from the answer before it");
  });

  it("names a retry that reverted to the base resume, and puts the clean lines back", () => {
    const reverted = cs([]);
    const c = classifyRetry(BASE, first, reverted, [hard("R1.1")]);
    expect(c.kind).toBe("reverted to the base resume");
    expect(c.clean.sort()).toEqual(["R1.2", "R1.3"]);
    const merged = mergeRetry(first, reverted, c);
    expect(merged.changes.map((x) => x.bullet).sort()).toEqual(["R1.2", "R1.3"]);
  });

  it("puts back a skill order the retry dropped", () => {
    const withSkills = cs([{ bullet: "R1.1", text: "Led a 3 year cost program that cut cost 14 percent." }], null, ["S2", "S1"]);
    const retry = cs([{ bullet: "R1.1", text: "Led a 3 year cost program that cut cost 11 percent." }]);
    const c = classifyRetry(BASE, withSkills, retry, [hard("R1.1")]);
    expect(c.droppedSkillOrder).toBe(true);
    expect(mergeRetry(withSkills, retry, c).skills).toEqual(["S2", "S1"]);
  });

  it("a change whose text equals the base is not an edit, so it cannot be dropped", () => {
    const noop = cs([{ bullet: "R1.2", text: "Own the annual planning cycle." }]);
    const c = classifyRetry(BASE, noop, cs([]), []);
    expect(c.of).toBe(0);
    expect(c.dropped).toEqual([]);
  });

  /*
   * Review five's finding 8: three ways the previous answer lost work that the
   * classification did not see, because it read the shape of a change set
   * rather than what the change set does to the document. All three were
   * reproduced against this module before the rule below was written.
   */

  it("a tailored summary the retry does not repeat is a dropped line, counted with the rest and put back", () => {
    const withSummary = cs([{ bullet: "R1.1", text: "Led a 3 year cost program that cut cost 14 percent." }], "Strategy lead who cut cost 14 percent.");
    const retry = cs([{ bullet: "R1.1", text: "Led a 3 year cost program that cut cost 11 percent." }]);
    const c = classifyRetry(BASE, withSummary, retry, [hard("R1.1")]);
    expect(c.dropped).toEqual(["summary"]);
    expect(c.of).toBe(2);
    expect(c.clean).toEqual(["summary"]);
    const merged = mergeRetry(withSummary, retry, c);
    expect(merged.summary).toBe("Strategy lead who cut cost 14 percent.");
    expect(merged.summaryFacts).toEqual(["R1"]);
    // The retry's own line still wins on the line both answers edited.
    expect(merged.changes.find((x) => x.bullet === "R1.1")!.text).toBe("Led a 3 year cost program that cut cost 11 percent.");
    expect(describeRetry(c)).toBe("the retry dropped 1 of 2 edited lines; 1 line the validator had not objected to was put back from the answer before it, the summary among them");
  });

  it("a summary the validator objected to is not put back, and the description does not claim it was", () => {
    const withSummary = cs([{ bullet: "R1.1", text: "Led a 3 year cost program that cut cost 11 percent." }], "Strategy lead who cut cost 40 percent.");
    const retry = cs([{ bullet: "R1.1", text: "Led a 3 year cost program that cut cost 11 percent." }]);
    const c = classifyRetry(BASE, withSummary, retry, [hard("summary")]);
    expect(c.dropped).toEqual(["summary"]);
    expect(c.clean).toEqual([]);
    expect(mergeRetry(withSummary, retry, c).summary).toBeNull();
    // Two lines edited, R1.1 and the summary; the summary is the one dropped, and no clause claims it came back.
    expect(c.of).toBe(2);
    expect(describeRetry(c)).toBe("the retry dropped 1 of 2 edited lines");
  });

  it("the retry's own summary wins where both answers set one", () => {
    const withSummary = cs([], "Strategy lead who cut cost 14 percent.");
    const retry = cs([], "Strategy lead who cut cost 11 percent.");
    const c = classifyRetry(BASE, withSummary, retry, [hard("summary")]);
    expect(c.dropped).toEqual([]);
    expect(mergeRetry(withSummary, retry, c).summary).toBe("Strategy lead who cut cost 11 percent.");
  });

  it("a line the retry rewrote to the base text is dropped and put back, not refused because an entry for it exists", () => {
    const first = cs([
      { bullet: "R1.1", text: "Led a 3 year cost program that cut cost 14 percent." },
      { bullet: "R1.2", text: "Own the annual planning cycle end to end." },
    ]);
    // The retry returns the base text for R1.2 rather than omitting it, which is not an edit.
    const retry = cs([
      { bullet: "R1.1", text: "Led a 3 year cost program that cut cost 11 percent." },
      { bullet: "R1.2", text: "Own the annual planning cycle." },
    ]);
    const c = classifyRetry(BASE, first, retry, [hard("R1.1")]);
    expect(c.dropped).toEqual(["R1.2"]);
    expect(c.clean).toEqual(["R1.2"]);
    const merged = mergeRetry(first, retry, c);
    // One entry for R1.2, and it is the previous answer's line: the description's claim is now true of the merge.
    expect(merged.changes.filter((x) => x.bullet === "R1.2")).toHaveLength(1);
    expect(merged.changes.find((x) => x.bullet === "R1.2")!.text).toBe("Own the annual planning cycle end to end.");
    expect(describeRetry(c)).toBe("the retry dropped 1 of 2 edited lines; 1 line the validator had not objected to was put back from the answer before it");
  });

  it("a skill order the retry replaced with the base order is dropped and put back, not only one it left empty", () => {
    const withSkills = cs([{ bullet: "R1.1", text: "Led a 3 year cost program that cut cost 14 percent." }], null, ["S2", "S1"]);
    const retry = cs([{ bullet: "R1.1", text: "Led a 3 year cost program that cut cost 11 percent." }], null, ["S1", "S2"]);
    const c = classifyRetry(BASE, withSkills, retry, [hard("R1.1")]);
    expect(c.droppedSkillOrder).toBe(true);
    expect(mergeRetry(withSkills, retry, c).skills).toEqual(["S2", "S1"]);
    expect(describeRetry(c)).toBe("the retry kept every edited line, substituted; the skill order was dropped and put back");
  });

  it("a skill order the retry changed to a third order is the retry's own, and is not put back", () => {
    const withSkills = cs([{ bullet: "R1.1", text: "Led a 3 year cost program that cut cost 14 percent." }], null, ["S2", "S1"]);
    const retry = cs([{ bullet: "R1.1", text: "Led a 3 year cost program that cut cost 11 percent." }], null, ["S2"]);
    const c = classifyRetry(BASE, withSkills, retry, [hard("R1.1")]);
    expect(c.droppedSkillOrder).toBe(false);
    expect(mergeRetry(withSkills, retry, c).skills).toEqual(["S2"]);
  });

  it("says what it did, as a soft finding that does not hold the packet", () => {
    const retry = cs([{ bullet: "R1.1", text: "Led a 3 year cost program that cut cost 11 percent." }]);
    const c = classifyRetry(BASE, first, retry, [hard("R1.1")]);
    expect(describeRetry(c)).toBe("the retry dropped 2 of 3 edited lines; 2 lines the validator had not objected to were put back from the answer before it");
    const f = retryFinding(c);
    expect(f.level).toBe("soft");
    expect(f.message).toBe("this answer is a retry");
  });
});
