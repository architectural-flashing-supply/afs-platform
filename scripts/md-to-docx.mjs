// Renders a Markdown spec to .docx. Handles the subset this repo's specs use:
// ATX headings, pipe tables, fenced code, bullets, bold/inline-code runs.
import fs from 'node:fs';
import { Document, Packer, Paragraph, TextRun, HeadingLevel, Table, TableRow, TableCell, WidthType, ShadingType } from 'docx';

const [, , inPath, outPath] = process.argv;
const lines = fs.readFileSync(inPath, 'utf8').split(/\r?\n/);

function runs(text) {
  const out = [];
  const re = /(\*\*[^*]+\*\*|`[^`]+`)/g;
  let last = 0, m;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(new TextRun(text.slice(last, m.index)));
    const t = m[0];
    if (t.startsWith('**')) out.push(new TextRun({ text: t.slice(2, -2), bold: true }));
    else out.push(new TextRun({ text: t.slice(1, -1), font: 'Consolas', size: 19 }));
    last = m.index + t.length;
  }
  if (last < text.length) out.push(new TextRun(text.slice(last)));
  return out.length ? out : [new TextRun(text)];
}

const cells = (l) => l.replace(/^\||\|$/g, '').split('|').map((c) => c.trim());
const isSep = (l) => /^\|?[\s:|-]+\|[\s:|-]*$/.test(l) && l.includes('-');

const children = [];
for (let i = 0; i < lines.length; i++) {
  const line = lines[i];

  if (line.startsWith('```')) {
    i++;
    const code = [];
    while (i < lines.length && !lines[i].startsWith('```')) code.push(lines[i++]);
    code.forEach((c) => children.push(new Paragraph({
      children: [new TextRun({ text: c || ' ', font: 'Consolas', size: 18 })],
      shading: { type: ShadingType.CLEAR, fill: 'F2F2F2' }, spacing: { before: 0, after: 0 },
    })));
    children.push(new Paragraph({ text: '' }));
    continue;
  }

  if (line.startsWith('|') && isSep(lines[i + 1] ?? '')) {
    const header = cells(line);
    i += 2;
    const body = [];
    while (i < lines.length && lines[i].startsWith('|')) body.push(cells(lines[i++]));
    i--;
    const width = { size: 100, type: WidthType.PERCENTAGE };
    children.push(new Table({
      width,
      rows: [
        new TableRow({ children: header.map((h) => new TableCell({
          children: [new Paragraph({ children: runs(h).map((r) => r) })],
          shading: { type: ShadingType.CLEAR, fill: 'E7E6E6' },
        })) }),
        ...body.map((r) => new TableRow({ children: header.map((_, c) =>
          new TableCell({ children: [new Paragraph({ children: runs(r[c] ?? '') })] })) })),
      ],
    }));
    children.push(new Paragraph({ text: '' }));
    continue;
  }

  const h = /^(#{1,4})\s+(.*)$/.exec(line);
  if (h) {
    const lvl = [HeadingLevel.TITLE, HeadingLevel.HEADING_1, HeadingLevel.HEADING_2, HeadingLevel.HEADING_3][h[1].length - 1];
    children.push(new Paragraph({ heading: lvl, children: runs(h[2]) }));
    continue;
  }
  if (/^---+$/.test(line)) { children.push(new Paragraph({ text: '', border: { bottom: { style: 'single', size: 6, color: 'AAAAAA' } } })); continue; }
  const b = /^(\s*)[-*]\s+(.*)$/.exec(line);
  if (b) { children.push(new Paragraph({ children: runs(b[2]), bullet: { level: Math.min(2, Math.floor(b[1].length / 2)) } })); continue; }
  const n = /^(\s*)(\d+)\.\s+(.*)$/.exec(line);
  if (n) { children.push(new Paragraph({ children: runs(`${n[2]}. ${n[3]}`), indent: { left: 360 + n[1].length * 180 } })); continue; }
  if (line.trim() === '') { children.push(new Paragraph({ text: '' })); continue; }
  children.push(new Paragraph({ children: runs(line) }));
}

const doc = new Document({ sections: [{ children }] });
const buf = await Packer.toBuffer(doc);
fs.writeFileSync(outPath, buf);
console.log(`${outPath}: ${buf.length} bytes`);
