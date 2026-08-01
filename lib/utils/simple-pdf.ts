// Minimal, dependency-free PDF byte generator. AFS's build has no PDF rendering
// library installed — this hand-writes a valid PDF (base-14 fonts only, no
// embedding required) so invoice and statement downloads work without adding
// a new package.
import { deflateSync } from 'zlib';

export type SimplePdfFont = 'regular' | 'bold' | 'mono';

export interface SimplePdfLine {
  text: string;
  font?: SimplePdfFont;
  size?: number;
  spaceBefore?: number; // extra vertical gap, in points, before this line
}

export interface SimplePdfImageData {
  /** Raw, unfiltered RGB pixel bytes, row-major, 3 bytes/pixel — see lib/utils/png-decode.ts. */
  rgb: Buffer;
  /** Raw, unfiltered alpha bytes, row-major, 1 byte/pixel — null if the source has no alpha channel. */
  alpha: Buffer | null;
  width: number;
  height: number;
}

export interface SimplePdfLogo {
  image: SimplePdfImageData;
  /** Points from the left page edge. */
  x: number;
  /** Points from the TOP page edge — same top-down convention the line cursor uses. */
  yFromTop: number;
  /** Display size, in points — independent of the source image's pixel dimensions. */
  width: number;
  height: number;
}

const FONT_KEY: Record<SimplePdfFont, string> = { regular: 'F1', bold: 'F2', mono: 'F3' };
const FONT_BASE: Record<SimplePdfFont, string> = {
  regular: 'Helvetica',
  bold: 'Helvetica-Bold',
  mono: 'Courier',
};

/** Exported so callers (e.g. lib/utils/bid-document-pdf.ts) can position a logo relative to the same page geometry, instead of duplicating these numbers. */
export const PAGE_WIDTH = 612;
const PAGE_HEIGHT = 792;
export const MARGIN_LEFT = 50;
const MARGIN_TOP = 742;
const MARGIN_BOTTOM = 46;
const DEFAULT_LINE_HEIGHT = 14;

function sanitizeText(text: string): string {
  return Array.from(text)
    .map((ch) => ((ch.codePointAt(0) ?? 0) <= 255 ? ch : '?'))
    .join('');
}

function escapePdfText(text: string): string {
  return sanitizeText(text).replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
}

/**
 * Builds a PDF from top-to-bottom text lines, breaking to a new page
 * whenever the next line would fall below the bottom margin. Every existing
 * caller (invoice/statement PDFs) fits on one page, so this is a superset of
 * the original single-page behavior — a bid document (lib/utils/
 * bid-document-pdf.ts) can carry an unbounded number of sections/line items,
 * which is what actually needs it.
 *
 * An optional logo image is drawn on page 1 only, positioned independently
 * of the text cursor — it lives in the top margin band and never competes
 * with the line-height budget.
 */
export function buildSimplePdf(lines: SimplePdfLine[], opts?: { logo?: SimplePdfLogo }): Buffer {
  const pageBodies: string[] = [];
  let current: string[] = [];
  let y = MARGIN_TOP;
  let currentFont = '';
  let currentSize = 0;

  function flushPage() {
    pageBodies.push(current.join('\n'));
    current = [];
    y = MARGIN_TOP;
    currentFont = '';
    currentSize = 0;
  }

  for (const line of lines) {
    const spaceBefore = line.spaceBefore ?? 0;
    if (y - spaceBefore - DEFAULT_LINE_HEIGHT < MARGIN_BOTTOM) {
      flushPage();
    }
    y -= spaceBefore;
    const fontKey = FONT_KEY[line.font ?? 'regular'];
    const size = line.size ?? 10;
    if (fontKey !== currentFont || size !== currentSize) {
      current.push(`/${fontKey} ${size} Tf`);
      currentFont = fontKey;
      currentSize = size;
    }
    current.push(`1 0 0 1 ${MARGIN_LEFT} ${Math.max(y, 24)} Tm (${escapePdfText(line.text)}) Tj`);
    y -= DEFAULT_LINE_HEIGHT;
  }
  flushPage();

  const pageStreams: Buffer[] = pageBodies.map((body, index) => {
    const parts: string[] = [];
    if (index === 0 && opts?.logo) {
      const { x, yFromTop, width, height } = opts.logo;
      const pdfY = PAGE_HEIGHT - yFromTop - height;
      parts.push('q', `${width} 0 0 ${height} ${x} ${pdfY} cm`, '/Im0 Do', 'Q');
    }
    parts.push('BT', body, 'ET');
    return Buffer.from(parts.join('\n'), 'latin1');
  });

  // Object numbering: 1 Catalog, 2 Pages, 3-5 the three base-14 fonts,
  // then (only if a logo is present) the image XObject and its optional
  // SMask, then one Page + Contents object pair per page. Ids are assigned
  // contiguously as they're allocated below, so a plain 1..maxId walk
  // during serialization always finds every object.
  const objects = new Map<number, { dict: string; stream?: Buffer }>();
  let nextId = 6;

  let imageObjId: number | null = null;
  let smaskObjId: number | null = null;
  if (opts?.logo) {
    const { image } = opts.logo;
    if (image.alpha) {
      smaskObjId = nextId++;
      const smaskStream = deflateSync(image.alpha);
      objects.set(smaskObjId, {
        dict:
          `<< /Type /XObject /Subtype /Image /Width ${image.width} /Height ${image.height} ` +
          `/ColorSpace /DeviceGray /BitsPerComponent 8 /Filter /FlateDecode /Length ${smaskStream.length} >>`,
        stream: smaskStream,
      });
    }
    imageObjId = nextId++;
    const imageStream = deflateSync(image.rgb);
    objects.set(imageObjId, {
      dict:
        `<< /Type /XObject /Subtype /Image /Width ${image.width} /Height ${image.height} /ColorSpace /DeviceRGB ` +
        `/BitsPerComponent 8 /Filter /FlateDecode /Length ${imageStream.length}` +
        (smaskObjId ? ` /SMask ${smaskObjId} 0 R` : '') +
        ' >>',
      stream: imageStream,
    });
  }

  const resourcesDict = imageObjId
    ? `/Resources << /Font << /F1 3 0 R /F2 4 0 R /F3 5 0 R >> /XObject << /Im0 ${imageObjId} 0 R >> >>`
    : `/Resources << /Font << /F1 3 0 R /F2 4 0 R /F3 5 0 R >> >>`;

  const pageIds: number[] = [];
  for (const streamBytes of pageStreams) {
    const pageId = nextId++;
    const contentsId = nextId++;
    pageIds.push(pageId);
    objects.set(pageId, {
      dict: `<< /Type /Page /Parent 2 0 R ${resourcesDict} /MediaBox [0 0 ${PAGE_WIDTH} ${PAGE_HEIGHT}] /Contents ${contentsId} 0 R >>`,
    });
    objects.set(contentsId, { dict: `<< /Length ${streamBytes.length} >>`, stream: streamBytes });
  }

  objects.set(1, { dict: '<< /Type /Catalog /Pages 2 0 R >>' });
  objects.set(2, {
    dict: `<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(' ')}] /Count ${pageIds.length} >>`,
  });
  objects.set(3, { dict: `<< /Type /Font /Subtype /Type1 /BaseFont /${FONT_BASE.regular} >>` });
  objects.set(4, { dict: `<< /Type /Font /Subtype /Type1 /BaseFont /${FONT_BASE.bold} >>` });
  objects.set(5, { dict: `<< /Type /Font /Subtype /Type1 /BaseFont /${FONT_BASE.mono} >>` });

  const maxId = nextId - 1;
  const chunks: Buffer[] = [];
  const offsets: number[] = new Array(maxId + 1).fill(0);
  let pos = 0;

  function push(buf: Buffer) {
    chunks.push(buf);
    pos += buf.length;
  }
  function pushStr(str: string) {
    push(Buffer.from(str, 'latin1'));
  }

  pushStr('%PDF-1.4\n');
  for (let id = 1; id <= maxId; id++) {
    const obj = objects.get(id);
    if (!obj) continue;
    offsets[id] = pos;
    pushStr(`${id} 0 obj\n${obj.dict}\n`);
    if (obj.stream) {
      pushStr('stream\n');
      push(obj.stream);
      pushStr('\nendstream\n');
    }
    pushStr('endobj\n');
  }

  const xrefStart = pos;
  let xref = `xref\n0 ${maxId + 1}\n0000000000 65535 f \n`;
  for (let id = 1; id <= maxId; id++) {
    xref += `${String(offsets[id]).padStart(10, '0')} 00000 n \n`;
  }
  pushStr(xref);
  pushStr(`trailer\n<< /Size ${maxId + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF`);

  return Buffer.concat(chunks);
}
