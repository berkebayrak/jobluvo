import { describe, expect, it } from "vitest";
import { rotateByFamily, shuffle } from "./sample";

/*
 * The draw's order: cells rotate families, so a small draw spans them
 * instead of taking the alphabetically first family's cells (D-023).
 */

describe("the stratified draw", () => {
  it("visits one cell of each family in turn", () => {
    const keys = ["ashby|senior|long", "ashby|mid|short", "lever|mid|short", "gem|mid|short", "ashby|mid|long", "workable|senior|short"];
    expect(rotateByFamily(keys)).toEqual(["ashby|mid|long", "gem|mid|short", "lever|mid|short", "workable|senior|short", "ashby|mid|short", "ashby|senior|long"]);
  });
  it("shuffles the same list the same way for the same seed", () => {
    const xs = ["a", "b", "c", "d", "e", "f"];
    expect(shuffle(xs, 7)).toEqual(shuffle(xs, 7));
    expect(shuffle(xs, 7)).not.toEqual(shuffle(xs, 8));
  });
});
