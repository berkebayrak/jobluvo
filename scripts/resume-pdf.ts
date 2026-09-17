import { mkdirSync, writeFileSync } from "node:fs";
import { jackResumeLines } from "@/server/profile/demo";
import { textPdf } from "@/server/profile/pdf";

/**
 * Renders Jack Miller's seeded facts as the resume PDF the extractor is
 * measured against, scripts/fixtures/jack-miller-resume.pdf. Deterministic,
 * so the fixture is reproducible from the facts. `npm run resume-pdf`.
 */
mkdirSync("scripts/fixtures", { recursive: true });
const pdf = textPdf(jackResumeLines());
writeFileSync("scripts/fixtures/jack-miller-resume.pdf", pdf);
writeFileSync("scripts/fixtures/jack-miller-resume.txt", jackResumeLines().join("\n"));
console.log(`wrote scripts/fixtures/jack-miller-resume.pdf, ${pdf.length} bytes, ${jackResumeLines().length} lines`);
