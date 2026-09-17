import { describe, expect, it } from "vitest";
import { decisionBody } from "./decision";

const id = "62ea8410-07a2-4f8a-9203-37b109e9a461";

describe("the decision body", () => {
  it("reads a replace as a replace, never as an empty decision", () => {
    const r = decisionBody.safeParse({ replaceWith: id });
    expect(r.success && "replaceWith" in r.data && r.data.replaceWith).toBe(id);
  });
  it("reads single decisions, and refuses a body that is neither", () => {
    const r = decisionBody.safeParse({ confirm: [id], reject: [] });
    expect(r.success && "confirm" in r.data && r.data.confirm).toEqual([id]);
    expect(decisionBody.safeParse({ replaceWith: id, confirm: [id] }).success).toBe(false);
    expect(decisionBody.safeParse({ confirm: ["not-a-uuid"] }).success).toBe(false);
    expect(decisionBody.safeParse({ something: 1 }).success).toBe(false);
  });
});
