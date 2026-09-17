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
  it("reads a decision by id and version, a replace with the facts the page showed, and an edit at a version", () => {
    const d = decisionBody.safeParse({ confirm: [{ id, version: 2 }], reject: [id] });
    expect(d.success && "confirm" in d.data && d.data.confirm).toEqual([{ id, version: 2 }]);
    expect(decisionBody.safeParse({ confirm: [{ id, version: 0 }] }).success).toBe(false);
    expect(decisionBody.safeParse({ confirm: [{ id }] }).success).toBe(false);
    const r = decisionBody.safeParse({ replaceWith: id, seen: [{ id, version: 1 }] });
    expect(r.success && "replaceWith" in r.data && r.data.seen).toEqual([{ id, version: 1 }]);
    const e = decisionBody.safeParse({ edit: { id, version: 1, data: { name: "SQL", years: 6 } } });
    expect(e.success && "edit" in e.data && e.data.edit.data).toEqual({ name: "SQL", years: 6 });
    expect(decisionBody.safeParse({ edit: { id, data: {} } }).success).toBe(false);
    expect(decisionBody.safeParse({ edit: { id, version: 1, data: {} }, confirm: [id] }).success).toBe(false);
  });
});
