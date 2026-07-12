// Minimal, dependency-free PDF byte generator. AFS's build has no PDF rendering
// library installed — this hand-writes a valid single-page PDF (base-14 fonts
// only, no embedding required) so invoice and statement downloads work without
// adding a new package.

export type SimplePdfFont = 'regular' | 'bold' | 'mono';

export interface SimplePdfLine {
  text: string;
  font?: SimplePdfFont;
  size?: number;
  spaceBefore?: number; // extra vertical gap, in points, before this line
}

const FONT_KEY: Record<SimplePdfFont, string> = { regular: 'F1', bold: 'F2', mono: 'F3' };
const FONT_BASE: Record<SimplePdfFont, string> = {
  regular: 'Helvetica',
  bold: 'Helvetica-Bold',
  mono: 'Courier',
};

const PAGE_WIDTH = 612;
const PAGE_HEIGHT = 792;
const MARGIN_LEFT = 50;
const MARGIN_TOP = 742;
const DEFAULT_LINE_HEIGHT = 14;

function sanitizeText(text: string): string {
  return Array.from(text)
    .map((ch) => ((ch.codePointAt(0) ?? 0) <= 255 ? ch : '?'))
    .join('');
}

function escapePdfText(text: string): string {
  return sanitizeText(text).replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
}

/** Builds a single-page PDF from top-to-bottom text lines. */
export function buildSimplePdf(lines: SimplePdfLine[]): Buffer {
  let y = MARGIN_TOP;
  const streamParts: string[] = ['BT'];
  let currentFont = '';
  let currentSize = 0;

  for (const line of lines) {
    const fontKey = FONT_KEY[line.font ?? 'regular'];
    const size = line.size ?? 10;
    if (line.spaceBefore) y -= line.spaceBefore;
    if (fontKey !== currentFont || size !== currentSize) {
      streamParts.push(`/${fontKey} ${size} Tf`);
      currentFont = fontKey;
      currentSize = size;
    }
    streamParts.push(`1 0 0 1 ${MARGIN_LEFT} ${Math.max(y, 24)} Tm (${escapePdfText(line.text)}) Tj`);
    y -= DEFAULT_LINE_HEIGHT;
  }
  streamParts.push('ET');
  const streamBytes = Buffer.from(streamParts.join('\n'), 'latin1');

  const objects: Record<number, string> = {
    1: '<< /Type /Catalog /Pages 2 0 R >>',
    2: '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    3: `<< /Type /Page /Parent 2 0 R /Resources << /Font << /F1 4 0 R /F2 5 0 R /F3 6 0 R >> >> /MediaBox [0 0 ${PAGE_WIDTH} ${PAGE_HEIGHT}] /Contents 7 0 R >>`,
    4: `<< /Type /Font /Subtype /Type1 /BaseFont /${FONT_BASE.regular} >>`,
    5: `<< /Type /Font /Subtype /Type1 /BaseFont /${FONT_BASE.bold} >>`,
    6: `<< /Type /Font /Subtype /Type1 /BaseFont /${FONT_BASE.mono} >>`,
  };

  const chunks: Buffer[] = [];
  const offsets: number[] = new Array(8).fill(0);
  let pos = 0;

  function push(str: string) {
    const buf = Buffer.from(str, 'latin1');
    chunks.push(buf);
    pos += buf.length;
  }

  push('%PDF-1.4\n');
  for (let i = 1; i <= 6; i++) {
    offsets[i] = pos;
    push(`${i} 0 obj\n${objects[i]}\nendobj\n`);
  }
  offsets[7] = pos;
  push(`7 0 obj\n<< /Length ${streamBytes.length} >>\nstream\n`);
  chunks.push(streamBytes);
  pos += streamBytes.length;
  push('\nendstream\nendobj\n');

  const xrefStart = pos;
  let xref = `xref\n0 8\n0000000000 65535 f \n`;
  for (let i = 1; i <= 7; i++) {
    xref += `${String(offsets[i]).padStart(10, '0')} 00000 n \n`;
  }
  push(xref);
  push(`trailer\n<< /Size 8 /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF`);

  return Buffer.concat(chunks);
}
