import { describe, expect, it } from "vitest";
import { factsFrom, type ExtractOutput } from "./extract";
import { textPdf, wrap } from "./pdf";

const base: ExtractOutput = {
  name: "Jack Miller",
  email: "jack.miller@jobluvo.com",
  location: "Istanbul, Turkey",
  links: ["linkedin.com/in/jackmiller"],
  employment: [
    { company: "Arvento", title: "Head of Strategy and PMO", location: "Istanbul, Turkey", start: "2022-03", end: null, bullets: ["Lead the strategy function.", ""], evidence: "Head of Strategy and PMO, Arvento" },
  ],
  education: [{ institution: "Koc University", degree: "MBA", field: "Executive MBA, part time", start: "2018-09", end: "2020-06", notes: [], evidence: "MBA, Koc University" }],
  skills: [{ name: "SQL", years: 6, evidence: "SQL (6 years)" }],
  answers: [{ question: "Notice period", answer: "30 days", evidence: "Notice period: 30 days" }],
  issues: [],
};

describe("reading the extractor's answer into facts", () => {
  it("keeps every fact the schemas accept, with its kind and evidence, and drops an empty bullet", () => {
    const { facts, issues } = factsFrom(base);
    expect(issues).toEqual([]);
    expect(facts.map((f) => f.kind)).toEqual(["contact", "link", "employment", "education", "skill", "answer"]);
    const emp = facts.find((f) => f.kind === "employment")!;
    expect(emp.data).toEqual({ company: "Arvento", title: "Head of Strategy and PMO", location: "Istanbul, Turkey", start: "2022-03", bullets: ["Lead the strategy function."] });
    expect(emp.evidence).toBe("Head of Strategy and PMO, Arvento");
    expect(facts.find((f) => f.kind === "education")!.data).toMatchObject({ institution: "Koc University", degree: "MBA", start: "2018-09", end: "2020-06" });
  });
  it("turns a fact the schema refuses into an issue instead of a fact, so a bad date never reaches the screen as good", () => {
    const { facts, issues } = factsFrom({
      ...base,
      employment: [{ ...base.employment[0], start: "March 2022" }],
      education: [{ ...base.education[0], start: "2018", end: "unknown" }],
      issues: ["Second page is a scan and partly unreadable"],
    });
    expect(facts.some((f) => f.kind === "employment")).toBe(false);
    expect(issues[0]).toBe("Second page is a scan and partly unreadable");
    expect(issues[1]).toMatch(/Head of Strategy and PMO at Arvento: start/);
    // Education keeps the row and drops the dates it cannot read.
    const edu = facts.find((f) => f.kind === "education")!;
    expect(edu.data).toEqual({ institution: "Koc University", degree: "MBA", field: "Executive MBA, part time" });
  });
  it("writes no contact fact when the resume gives no name, email or location", () => {
    const { facts } = factsFrom({ ...base, name: null, email: null, location: null, links: [] });
    expect(facts.map((f) => f.kind)).toEqual(["employment", "education", "skill", "answer"]);
  });
});

describe("the PDF writer", () => {
  it("wraps long lines at words and keeps a bullet's indent", () => {
    expect(wrap("short line")).toEqual(["short line"]);
    const long = `- ${"word ".repeat(30).trim()}`;
    const lines = wrap(long, 60);
    expect(lines.length).toBeGreaterThan(1);
    expect(lines[0].length).toBeLessThanOrEqual(60);
    expect(lines[1].startsWith("  ")).toBe(true);
  });
  it("produces a well formed single font PDF whose text stream carries the lines", () => {
    const pdf = textPdf(["Jack Miller", "Head of Strategy (PMO)", ...Array.from({ length: 60 }, (_, i) => `line ${i}`)]).toString("latin1");
    expect(pdf.startsWith("%PDF-1.4")).toBe(true);
    expect(pdf.trimEnd().endsWith("%%EOF")).toBe(true);
    expect(pdf).toContain("/Type /Catalog");
    expect(pdf).toContain("/BaseFont /Helvetica");
    expect(pdf).toContain("(Jack Miller) Tj");
    expect(pdf).toContain("(Head of Strategy \\(PMO\\)) Tj");
    expect(pdf).toContain("/Count 2");
    const startxref = Number(/startxref\n(\d+)/.exec(pdf)![1]);
    expect(pdf.slice(startxref, startxref + 4)).toBe("xref");
  });
});
