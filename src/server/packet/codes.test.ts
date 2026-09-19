import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { CITATION_KIND, codeOf, describeFindingsRead, FINDING_CODES, FINDING_LABELS, isFindingCode, labelOf, readFindings, unknownCodeOf, type FindingCode } from "./codes";

/*
 * Finding 17. A report counts codes, so the codes have to be complete and
 * stable. Two things are worth a test rather than a convention: that no
 * finding is created without one, and that a stored finding written before
 * codes existed still reads as the right code.
 */

/**
 * Every non test source in this directory, listed by reading the directory
 * rather than by naming the files (the tenth review's item B).
 *
 * The list used to be four names. Nothing stopped a fifth file being added and
 * never scanned, and a scan that silently covers less than it claims is the
 * failure mode this file exists to catch. There is no list now.
 *
 * **Test files are excluded, deliberately**, because fixtures construct
 * findings without codes on purpose: `retry.test.ts` builds one to hand to a
 * classifier. **What that leaves uncovered, said rather than left implied:**
 * a finding constructed in a test file is not checked while it lives there.
 * The moment such a helper moves into a source file it is scanned, because the
 * scan is over whatever non test files the directory holds, which is the case
 * the review was worried about. A construction somewhere else in the tree
 * entirely is covered by the second test below.
 */
const SOURCES = readdirSync(import.meta.dirname).filter((f) => f.endsWith(".ts") && !f.endsWith(".test.ts"));
const read = (f: string) => readFileSync(join(import.meta.dirname, f), "utf8");

/** A finding being constructed, as opposed to the type being declared: the level is followed by a comma, which `level: "hard" | "review" | "soft";` in the schema is not. */
const CONSTRUCTS = /level: "(hard|review|soft)",/;

/** Every .ts file under a directory, recursively, tests excluded. */
function sourcesUnder(dir: string): string[] {
  const out: string[] = [];
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, e.name);
    if (e.isDirectory()) out.push(...sourcesUnder(full));
    else if (e.name.endsWith(".ts") && !e.name.endsWith(".test.ts")) out.push(full);
  }
  return out;
}

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

  it("finds no finding constructed outside this directory, which is what the directory scan assumes", () => {
    /*
     * The other half of the tenth review's item B. Scanning this directory closes "a fifth file here"; it says
     * nothing about a finding constructed in `src/server/match` or in a script. This says it, so the assumption
     * the scan above rests on is checked rather than believed.
     *
     * The type declaration in `db/schema.ts` is not a construction and is excluded by the shape of the pattern:
     * a construction writes `level: "hard",` and the declaration writes `level: "hard" | "review" | "soft";`.
     */
    const root = join(import.meta.dirname, "..", "..");
    const all = sourcesUnder(root);
    // A scan that walked nothing would report no constructions and mean nothing. Two floors, so neither the walk
    // nor the pattern can go quiet: the tree has files in it, and the pattern still matches inside this directory.
    expect(all.length).toBeGreaterThanOrEqual(30);
    expect(all.filter((f) => f.includes(join("server", "packet")) && CONSTRUCTS.test(readFileSync(f, "utf8"))).length).toBeGreaterThanOrEqual(4);
    const elsewhere = all.filter((f) => !f.includes(join("server", "packet"))).filter((f) => CONSTRUCTS.test(readFileSync(f, "utf8")));
    expect(elsewhere.map((f) => f.slice(root.length + 1))).toEqual([]);
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

  it("has a label for every code, and no two codes share one", () => {
    /*
     * D-061. The report's label map was partial with a fallback, so a code with no entry printed "unclassified"
     * and the table kept its shape. Four codes had drifted into that state and one of them, `posting-moved`, is a
     * live reason a row is held, so the report read before a restamp could not name a reason in front of the
     * reader.
     *
     * The type makes an unlabelled code a typecheck failure, which catches it in `npm run check` before it prints
     * anything. This asserts the same at run time, and asserts the labels are distinct, because two codes sharing
     * a label is the other way a count table merges two reasons into one bucket without saying so.
     */
    const unlabelled = FINDING_CODES.filter((c) => !FINDING_LABELS[c]?.trim());
    expect(unlabelled).toEqual([]);
    const labels = FINDING_CODES.map((c) => FINDING_LABELS[c]);
    const shared = labels.filter((l, i) => labels.indexOf(l) !== i);
    expect(shared).toEqual([]);
    // And the four that were printing as unclassified are named, by the names the review asked for.
    for (const code of ["posting-moved", "profile-not-reproducible", "assessment-not-run", "resume-repaired"] as const) {
      expect(FINDING_LABELS[code]).not.toContain("unclassified");
      expect(labelOf({ code, message: "anything at all" })).toBe(FINDING_LABELS[code]);
    }
  });

  it("does not hand on a stored code this build has never declared", () => {
    /*
     * The tenth review's item 4. `codeOf` was `if (f.code) return f.code as FindingCode`, an unchecked cast, and
     * the type that makes it look safe is a claim about `jsonb` rather than a fact about it. A row written by a
     * later build, a hand edit or a restored snapshot can carry anything, and the cast handed it on as valid, so
     * `FINDING_LABELS[code]` evaluated to `undefined` and the count table grew a row called "undefined": the
     * defect D-061 removed from the map, re-entering through the data.
     */
    const rogue = { code: "a-rule-from-another-build", message: "value appears in no confirmed fact" };
    expect(isFindingCode("a-rule-from-another-build")).toBe(false);
    expect(codeOf(rogue)).toBeNull();
    // Named, and named as itself. Not "undefined", and not folded into the reason its message would have matched.
    expect(labelOf(rogue)).toBe("unknown code: a-rule-from-another-build");
    expect(labelOf(rogue)).not.toContain("undefined");
    expect(unknownCodeOf(rogue)).toBe("a-rule-from-another-build");
    // It does not fall through to the legacy message table. That would relabel it as a rule it is not.
    expect(labelOf(rogue)).not.toBe(FINDING_LABELS["value-unknown"]);
  });

  it("reads a stored set at the boundary and reports what it could not recognise, by name", () => {
    // The boundary itself: what `validator-report` and `reconcile-sample` print before any row is interpreted.
    const read = readFindings([
      { code: "value-unknown", message: "value appears in no confirmed fact" },
      { code: "a-rule-from-another-build", message: "whatever it said" },
      { code: "a-rule-from-another-build", message: "again" },
      { message: "summary not revalidated: the packet stores no change set" },
      { message: "a rule nobody has written yet" },
    ]);
    expect(read.total).toBe(5);
    expect([...read.unknownCodes]).toEqual([["a-rule-from-another-build", 2]]);
    // The legacy one is recognised by message and is not counted as unrecognised; the last one is.
    expect(read.unrecognised).toBe(1);
    const line = describeFindingsRead(read)!;
    expect(line).toContain('2 carrying the code "a-rule-from-another-build"');
    expect(line).toContain("1 carrying no code");
    // A clean set still prints, and says so. A boundary that goes quiet when it finds nothing cannot be told
    // from one that did not run, which is the floor the two scans above already carry.
    expect(describeFindingsRead(readFindings([{ code: "value-unknown", message: "x" }]))).toBe(
      "1 stored findings read, and every code on them is one this build declares",
    );
  });

  it("names a finding that carries no code this build knows as codeless, rather than as one of the labels", () => {
    // The other half, and it is not the same defect: a row written before codes existed whose message no legacy
    // prefix matches is genuinely unknown, and saying so is right. What is forbidden is a KNOWN code with no label.
    expect(labelOf({ message: "a rule nobody has written yet" })).toBe("no code: a rule nobody has written yet");
    expect(labelOf({ message: "posting moved: the job's text has changed" })).toBe(FINDING_LABELS["posting-moved"]);
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
