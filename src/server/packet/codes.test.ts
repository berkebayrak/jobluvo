import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { CITATION_KIND, codeOf, FINDING_CODES, type FindingCode } from "./codes";

/*
 * Finding 17. A report counts codes, so the codes have to be complete and
 * stable. Two things are worth a test rather than a convention: that no
 * finding is created without one, and that a stored finding written before
 * codes existed still reads as the right code.
 */

const SOURCES = ["validate.ts", "entities.ts", "replay.ts", "retry.ts"];
const read = (f: string) => readFileSync(join(import.meta.dirname, f), "utf8");

describe("every finding carries a stable code", () => {
  it("creates no finding without a code", () => {
    // Every object literal that sets a level is a finding, and each must set a code in the same literal.
    const missing: string[] = [];
    let scanned = 0;
    for (const f of SOURCES) {
      const src = read(f);
      for (const line of src.split("\n")) {
        const stripped = line.replace(/^\s*(\/\/|\*).*/, "");
        if (!/level: "(hard|review|soft)"/.test(stripped)) continue;
        scanned += 1;
        // The multi line literals set the code on the line after the level; allow either.
        const i = src.indexOf(line);
        const window = src.slice(i, i + line.length + 120);
        if (!/code:/.test(window)) missing.push(`${f}: ${line.trim()}`);
      }
    }
    expect(missing).toEqual([]);
    // A scan that matched nothing would report no omissions and mean nothing; this is the floor it must clear.
    // Lowered from 20 when the meaning comparison was removed and the findings that went with it stopped being written (D-034).
    expect(scanned).toBeGreaterThanOrEqual(14);
  });

  it("uses only codes the list knows, and the list has no duplicates", () => {
    const used = new Set<string>();
    for (const f of SOURCES) for (const m of read(f).matchAll(/code: "([a-z-]+)"/g)) used.add(m[1]!);
    expect([...used].filter((c) => !(FINDING_CODES as readonly string[]).includes(c))).toEqual([]);
    expect(new Set(FINDING_CODES).size).toBe(FINDING_CODES.length);
  });

  it("names every code it declares a citation failure", () => {
    for (const code of Object.keys(CITATION_KIND)) expect(FINDING_CODES).toContain(code);
  });

  it("reads a finding that carries its code, and never rewrites it from the message", () => {
    // A code wins over the message, which is the whole point: the message is free to change.
    expect(codeOf({ code: "value-not-in-cited", message: "anything at all" })).toBe("value-not-in-cited");
  });

  it("reads the code of a finding stored before codes existed, from its message", () => {
    const legacy: [string, FindingCode][] = [
      ["value is on the profile but not in the cited facts", "value-not-in-cited"],
      ["responsibility is not in the cited facts", "responsibility-not-in-cited"],
      ["no fact cited for this line", "no-fact-cited"],
      ["cites a fact from another role", "wrong-role"],
      ["value does not mean what the fact means: a target is not a result", "value-contradicts"],
      ["summary not revalidated: the packet stores no change set", "summary-not-revalidated"],
    ];
    for (const [message, code] of legacy) expect(codeOf({ message })).toBe(code);
  });

  it("reads an unknown message as no code, so it is counted as unrecognised and not as some other kind", () => {
    expect(codeOf({ message: "a rule nobody has written yet" })).toBeNull();
  });
});
