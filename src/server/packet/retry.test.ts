import { describe, expect, it } from "vitest";
import type { PacketFinding, ResumeDocument } from "@/db/schema";
import type { ChangeSet } from "./resume";
import { classifyRetry, describeRetry, explicitOf, mergeRetry, objectedTo, retryFinding } from "./retry";

/*
 * Finding 14. A retry may replace a line the validator objected to and may
 * not silently delete one it did not. The classification says which happened,
 * and the merge puts back only the lines the validator had no complaint about.
 *
 * D-039 narrows "delete" to "never mentioned". A retry that names a line has
 * decided about it, and one of the decisions the prompt asks for is to write
 * the resume's own line back where the tailored one is not supported. Three
 * of the tests below asserted the opposite, because finding 8 was written when
 * the validator still read meaning and "the validator did not object" still
 * carried information. They are inverted here rather than deleted, with what
 * each one now asserts and why, so the reversal is on the record.
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
    expect(describeRetry(c)).toBe("the retry edited a different set of lines and dropped 2 of 2 edited lines; 1 line the retry never named and the validator had not objected to was put back from the answer before it");
  });

  it("names a retry that reverted to the base resume, and puts the clean lines back", () => {
    const reverted = cs([]);
    const c = classifyRetry(BASE, first, reverted, [hard("R1.1")]);
    expect(c.kind).toBe("reverted to the base resume");
    expect(c.clean.sort()).toEqual(["R1.2", "R1.3"]);
    const merged = mergeRetry(first, reverted, c);
    expect(merged.changes.map((x) => x.bullet).sort()).toEqual(["R1.2", "R1.3"]);
  });

  it("puts back a skill order the retry gave no order in place of", () => {
    const withSkills = cs([{ bullet: "R1.1", text: "Led a 3 year cost program that cut cost 14 percent." }], null, ["S2", "S1"]);
    const retry = cs([{ bullet: "R1.1", text: "Led a 3 year cost program that cut cost 11 percent." }]);
    const c = classifyRetry(BASE, withSkills, retry, [hard("R1.1")]);
    expect(c.droppedSkillOrder).toBe(true);
    expect(mergeRetry(withSkills, retry, c).skills).toEqual(["S2", "S1"]);
    expect(describeRetry(c)).toBe("the retry kept every edited line, substituted; no skill order was given and the previous one was put back");
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
   *
   * Reading a line off the applied document survives D-039 and is still how
   * every count here is taken. What does not survive is the conclusion finding
   * 8 drew from it: that any line left at the base text should be put back. A
   * line the retry named and left at the base text is the read-back in the
   * prompt reverting a claim the facts do not support, and putting it back
   * reinstates the claim. The three tests below now assert that it stands.
   */

  it("a summary the retry does not repeat is still a dropped line, and it is the retry's decision, so it stands", () => {
    // Inverted by D-039. The schema makes every answer write the summary field, so there is no silence to tell apart
    // from a decision: a retry that returns no summary has returned no summary. Finding 8's count is unchanged, its
    // restoration is not. What this costs is a model that forgets its summary loses it, and that is the cheaper error:
    // the other way round keeps a summary the model's own read-back had just withdrawn.
    const withSummary = cs([{ bullet: "R1.1", text: "Led a 3 year cost program that cut cost 14 percent." }], "Strategy lead who cut cost 14 percent.");
    const retry = cs([{ bullet: "R1.1", text: "Led a 3 year cost program that cut cost 11 percent." }]);
    const c = classifyRetry(BASE, withSummary, retry, [hard("R1.1")]);
    expect(c.dropped).toEqual(["summary"]);
    expect(c.of).toBe(2);
    // Named, because the field is always written; so it is a reversion, not an omission, and nothing is put back.
    expect(c.reverted).toEqual(["summary"]);
    expect(c.omitted).toEqual([]);
    expect(c.clean).toEqual([]);
    const merged = mergeRetry(withSummary, retry, c);
    expect(merged.summary).toBeNull();
    // The retry's own line still wins on the line both answers edited.
    expect(merged.changes.find((x) => x.bullet === "R1.1")!.text).toBe("Led a 3 year cost program that cut cost 11 percent.");
    expect(describeRetry(c)).toBe("the retry dropped 1 of 2 edited lines; it left 1 of them at the resume's own text, which is its decision and stands, the summary among them");
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
    expect(describeRetry(c)).toBe("the retry dropped 1 of 2 edited lines; it left 1 of them at the resume's own text, which is its decision and stands, the summary among them");
  });

  it("the retry's own summary wins where both answers set one", () => {
    const withSummary = cs([], "Strategy lead who cut cost 14 percent.");
    const retry = cs([], "Strategy lead who cut cost 11 percent.");
    const c = classifyRetry(BASE, withSummary, retry, [hard("summary")]);
    expect(c.dropped).toEqual([]);
    expect(mergeRetry(withSummary, retry, c).summary).toBe("Strategy lead who cut cost 11 percent.");
  });

  it("a line the retry rewrote to the base text is its decision and is not put back", () => {
    // Inverted by D-039, and this is the case the sixth review names. Finding 8 read this as a drop the merge should
    // undo. It is the opposite: the retry named R1.2 and chose the resume's own words, which is what the prompt asks
    // for when a line's facts do not support it. Putting the tailored line back reinstated the claim, and the
    // remaining lookup passed it again because it holds no unknown number and no unknown name.
    const first = cs([
      { bullet: "R1.1", text: "Led a 3 year cost program that cut cost 14 percent." },
      { bullet: "R1.2", text: "Own the annual planning cycle end to end." },
    ]);
    const retry = cs([
      { bullet: "R1.1", text: "Led a 3 year cost program that cut cost 11 percent." },
      { bullet: "R1.2", text: "Own the annual planning cycle." },
    ]);
    const c = classifyRetry(BASE, first, retry, [hard("R1.1")]);
    // Still counted as dropped: the document says the line is back at the base text, and finding 8's reading of that stands.
    expect(c.dropped).toEqual(["R1.2"]);
    expect(c.reverted).toEqual(["R1.2"]);
    expect(c.omitted).toEqual([]);
    expect(c.clean).toEqual([]);
    const merged = mergeRetry(first, retry, c);
    expect(merged.changes.filter((x) => x.bullet === "R1.2")).toHaveLength(1);
    expect(merged.changes.find((x) => x.bullet === "R1.2")!.text).toBe("Own the annual planning cycle.");
    expect(describeRetry(c)).toBe("the retry dropped 1 of 2 edited lines; it left 1 of them at the resume's own text, which is its decision and stands");
  });

  it("the self check reverting a promotion is not undone by the merge, which is what item 2 of the sixth review is", () => {
    // The scenario in the review's own words. The validator objects to R1.1 only. The retry fixes R1.1 and, reading
    // its own work back, returns R1.2 at the resume's wording because "Own" is what the fact says and "Led" is not.
    // Nothing in the code can see that difference: both lines hold only known numbers and known names.
    const first = cs([
      { bullet: "R1.1", text: "Led a 3 year cost program that cut cost 14 percent." },
      { bullet: "R1.2", text: "Led the annual planning cycle." },
    ]);
    const retry = cs([
      { bullet: "R1.1", text: "Led a 3 year cost program that cut cost 11 percent." },
      { bullet: "R1.2", text: "Own the annual planning cycle." },
    ]);
    const c = classifyRetry(BASE, first, retry, [hard("R1.1")]);
    const merged = mergeRetry(first, retry, c);
    expect(merged.changes.find((x) => x.bullet === "R1.2")!.text).toBe("Own the annual planning cycle.");
    expect(merged.changes.find((x) => x.bullet === "R1.2")!.text).not.toBe("Led the annual planning cycle.");
  });

  it("a line the retry never names is an omission and is still put back, which is finding 14 unchanged", () => {
    const first = cs([
      { bullet: "R1.1", text: "Led a 3 year cost program that cut cost 14 percent." },
      { bullet: "R1.2", text: "Own the annual planning cycle end to end." },
    ]);
    // R1.2 is not in the answer at all: the retry said nothing about it, and silence is not a decision.
    const retry = cs([{ bullet: "R1.1", text: "Led a 3 year cost program that cut cost 11 percent." }]);
    const c = classifyRetry(BASE, first, retry, [hard("R1.1")]);
    expect(c.reverted).toEqual([]);
    expect(c.omitted).toEqual(["R1.2"]);
    expect(c.clean).toEqual(["R1.2"]);
    expect(mergeRetry(first, retry, c).changes.find((x) => x.bullet === "R1.2")!.text).toBe("Own the annual planning cycle end to end.");
  });

  it("a document mode answer names every line it returns, so a line it returns at the base text is not put back", () => {
    // The change set a document mode answer produces holds only the lines whose text differs from the base, so the
    // default reading would call a deliberately reverted line unspoken. The explicit set is read off the answer.
    const first = cs([{ bullet: "R1.2", text: "Own the annual planning cycle end to end." }]);
    const retry = cs([]);
    const asChanges = classifyRetry(BASE, first, retry, []);
    expect(asChanges.omitted).toEqual(["R1.2"]);
    expect(asChanges.clean).toEqual(["R1.2"]);
    const asDocument = classifyRetry(BASE, first, retry, [], { lines: new Set(["summary", "R1.1", "R1.2", "R1.3"]), skillOrder: true });
    expect(asDocument.reverted).toEqual(["R1.2"]);
    expect(asDocument.clean).toEqual([]);
    expect(mergeRetry(first, retry, asDocument)).toBe(retry);
    // And the changes mode reading is exactly what explicitOf says.
    expect(explicitOf(retry)).toEqual({ lines: new Set(["summary"]), skillOrder: false });
  });

  it("a skill order the retry wrote back as the base order is its decision, and is not put back", () => {
    // Inverted by D-039, for the same reason as the lines: an order the retry wrote is an order it chose, even when
    // it is the base's. Only an answer that gives no order at all has said nothing, and that case is the test above.
    const withSkills = cs([{ bullet: "R1.1", text: "Led a 3 year cost program that cut cost 14 percent." }], null, ["S2", "S1"]);
    const retry = cs([{ bullet: "R1.1", text: "Led a 3 year cost program that cut cost 11 percent." }], null, ["S1", "S2"]);
    const c = classifyRetry(BASE, withSkills, retry, [hard("R1.1")]);
    expect(c.droppedSkillOrder).toBe(false);
    expect(mergeRetry(withSkills, retry, c).skills).toEqual(["S1", "S2"]);
    expect(describeRetry(c)).toBe("the retry kept every edited line, substituted");
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
    expect(describeRetry(c)).toBe("the retry dropped 2 of 3 edited lines; 2 lines the retry never named and the validator had not objected to were put back from the answer before it");
    const f = retryFinding(c);
    expect(f.level).toBe("soft");
    expect(f.message).toBe("this answer is a retry");
  });
});
