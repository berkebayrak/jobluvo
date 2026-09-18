import { describe, expect, it } from "vitest";

// Deliberately failing, to prove the check chain stops here and does not run the build.
// This file is removed in the same session; it must never reach main.
describe("check chain proof", () => {
  it("fails on purpose", () => {
    expect(1).toBe(2);
  });
});
