import { describe, expect, it } from "vitest";
import { FlagError, oneOf, parseFlags, positiveInteger } from "./cli";

const spec = { booleans: ["no-store", "dry"], values: ["n", "only", "tag", "save"] } as const;

describe("parseFlags", () => {
  it("reads a boolean flag the same in every position", () => {
    const orders = [
      ["--no-store"],
      ["--no-store", "--save", "out.json"],
      ["--save", "out.json", "--no-store"],
      ["--n", "80", "--no-store", "--tag", "x", "--save", "out.json"],
      ["--no-store", "--dry"],
      ["--dry", "--no-store"],
    ];
    for (const argv of orders) {
      const f = parseFlags(argv, spec);
      expect(f.booleans["no-store"], argv.join(" ")).toBe(true);
    }
    expect(parseFlags(["--save", "out.json"], spec).booleans["no-store"]).toBe(false);
  });

  it("reads --dry before a value flag as dry, the case that made a dry run pay", () => {
    const f = parseFlags(["--dry", "--n", "20"], spec);
    expect(f.booleans.dry).toBe(true);
    expect(f.values.n).toBe("20");
  });

  it("never lets a boolean flag swallow the next token", () => {
    const f = parseFlags(["--no-store", "--save", "out.json"], spec);
    expect(f.values.save).toBe("out.json");
  });

  it("accepts --name=value and --name value alike", () => {
    expect(parseFlags(["--tag=x"], spec).values.tag).toBe("x");
    expect(parseFlags(["--tag", "x"], spec).values.tag).toBe("x");
  });

  it("refuses a value flag with no value", () => {
    expect(() => parseFlags(["--save"], spec)).toThrow(FlagError);
    expect(() => parseFlags(["--save", "--no-store"], spec)).toThrow(/--save needs a value/);
  });

  it("refuses an unknown flag, a bare word, a boolean with a value and a repeated value", () => {
    expect(() => parseFlags(["--nostore"], spec)).toThrow(/unknown flag --nostore/);
    expect(() => parseFlags(["out.json"], spec)).toThrow(/unexpected argument/);
    expect(() => parseFlags(["--dry=true"], spec)).toThrow(/takes no value/);
    expect(() => parseFlags(["--n", "1", "--n", "2"], spec)).toThrow(/given twice/);
  });

  it("returns every boolean false and every value absent on an empty argv", () => {
    const f = parseFlags([], spec);
    expect(f.booleans).toEqual({ "no-store": false, dry: false });
    expect(f.values).toEqual({});
  });
});

describe("positiveInteger and oneOf", () => {
  it("validates --n", () => {
    expect(positiveInteger(undefined, "n", 100)).toBe(100);
    expect(positiveInteger("80", "n", 100)).toBe(80);
    expect(() => positiveInteger("0", "n", 100)).toThrow(FlagError);
    expect(() => positiveInteger("--dry", "n", 100)).toThrow(FlagError);
    expect(() => positiveInteger("8.5", "n", 100)).toThrow(FlagError);
  });

  it("validates --only", () => {
    expect(oneOf(undefined, "only", ["changes", "document"])).toBeUndefined();
    expect(oneOf("changes", "only", ["changes", "document"])).toBe("changes");
    expect(() => oneOf("change", "only", ["changes", "document"])).toThrow(/must be one of changes, document/);
  });
});
