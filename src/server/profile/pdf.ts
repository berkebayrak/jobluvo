/*
 * A minimal PDF writer: Helvetica, one column, as many pages as the lines
 * need. No dependency, because the only PDF the code base has to produce is
 * the demo resume the extractor is measured against; a real resume comes
 * from the user. The output is a plain, well formed PDF 1.4 file whose text
 * any reader and any model can read.
 */

const PAGE_W = 612;
const PAGE_H = 792;
const MARGIN = 56;
const FONT_SIZE = 10.5;
const LEADING = 14;
const LINES_PER_PAGE = Math.floor((PAGE_H - 2 * MARGIN) / LEADING);
const CHARS_PER_LINE = 95;

/** Escapes a string for a PDF literal. Non Latin characters are replaced, Helvetica has no glyph for them. */
function literal(s: string): string {
  return s
    .replace(/[^\x20-\x7e]/g, "?")
    .replace(/\\/g, "\\\\")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)");
}

/** Wraps a line at word boundaries, keeping a bullet's indent on its continuation lines. */
export function wrap(line: string, width = CHARS_PER_LINE): string[] {
  if (line.length <= width) return [line];
  const indent = line.startsWith("- ") ? "  " : "";
  const words = line.split(" ");
  const out: string[] = [];
  let cur = "";
  for (const w of words) {
    const next = cur ? `${cur} ${w}` : w;
    if (next.length > width && cur) {
      out.push(cur);
      cur = indent + w;
    } else cur = next;
  }
  if (cur) out.push(cur);
  return out;
}

export function textPdf(lines: string[]): Buffer {
  const wrapped = lines.flatMap((l) => wrap(l));
  const pages: string[][] = [];
  for (let i = 0; i < wrapped.length; i += LINES_PER_PAGE) pages.push(wrapped.slice(i, i + LINES_PER_PAGE));
  if (!pages.length) pages.push([]);

  const objects: string[] = [];
  const add = (body: string) => {
    objects.push(body);
    return objects.length;
  };
  const catalog = add("");
  const pagesObj = add("");
  const font = add("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>");
  const pageIds: number[] = [];
  for (const page of pages) {
    const ops = [`BT /F1 ${FONT_SIZE} Tf ${LEADING} TL ${MARGIN} ${PAGE_H - MARGIN} Td`];
    for (const line of page) ops.push(`(${literal(line)}) Tj T*`);
    ops.push("ET");
    const stream = ops.join("\n");
    const content = add(`<< /Length ${Buffer.byteLength(stream, "latin1")} >>\nstream\n${stream}\nendstream`);
    const id = add(
      `<< /Type /Page /Parent ${pagesObj} 0 R /MediaBox [0 0 ${PAGE_W} ${PAGE_H}] /Resources << /Font << /F1 ${font} 0 R >> >> /Contents ${content} 0 R >>`,
    );
    pageIds.push(id);
  }
  objects[catalog - 1] = `<< /Type /Catalog /Pages ${pagesObj} 0 R >>`;
  objects[pagesObj - 1] = `<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(" ")}] /Count ${pageIds.length} >>`;

  let out = "%PDF-1.4\n";
  const offsets: number[] = [];
  objects.forEach((body, i) => {
    offsets.push(Buffer.byteLength(out, "latin1"));
    out += `${i + 1} 0 obj\n${body}\nendobj\n`;
  });
  const xref = Buffer.byteLength(out, "latin1");
  out += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const o of offsets) out += `${String(o).padStart(10, "0")} 00000 n \n`;
  out += `trailer\n<< /Size ${objects.length + 1} /Root ${catalog} 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(out, "latin1");
}
