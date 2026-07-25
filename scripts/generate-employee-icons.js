// One-off asset generator for the Employee PWA manifest icons
// (public/employee-icon-192.png, public/employee-icon-512.png).
//
// No image library (sharp/canvas) is installed in this project — see
// package.json — and neither is a native dependency worth adding for two
// static icon files. This writes valid PNGs from scratch using only Node's
// built-in `zlib` (for the PNG-required deflate/zlib stream) and a small
// hand-rolled CRC32, per the CRC32/zlib PNG spec. Run once with:
//   node scripts/generate-employee-icons.js
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const BLACK = [0, 0, 0];
const CRIMSON = [0xc0, 0x00, 0x1a]; // afs-crimson
const WHITE = [0xff, 0xff, 0xff];

// Standard 5x7 bitmap font, just the 3 glyphs this icon needs.
const FONT = {
  A: ['01110', '10001', '10001', '11111', '10001', '10001', '10001'],
  F: ['11111', '10000', '11110', '10000', '10000', '10000', '10000'],
  S: ['01111', '10000', '10000', '01110', '00001', '00001', '11110'],
};

function crc32(buf) {
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    crc ^= buf[i];
    for (let j = 0; j < 8; j++) {
      crc = crc & 1 ? (crc >>> 1) ^ 0xedb88320 : crc >>> 1;
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const typeBuf = Buffer.from(type, 'ascii');
  const lenBuf = Buffer.alloc(4);
  lenBuf.writeUInt32BE(data.length, 0);
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([lenBuf, typeBuf, data, crcBuf]);
}

function isInShield(x, y, size) {
  const fx = x / size;
  const fy = y / size;
  const left = 0.16;
  const right = 0.84;
  const top = 0.08;
  const taperStart = 0.62;
  const bottom = 0.94;

  if (fy < top || fy > bottom) return false;

  if (fy <= taperStart) {
    // Rounded-corner rectangle top section.
    const cornerR = 0.06;
    const inTopBand = fy < top + cornerR;
    if (inTopBand) {
      const nearLeft = fx < left + cornerR;
      const nearRight = fx > right - cornerR;
      if (nearLeft) {
        const dx = (left + cornerR - fx) / cornerR;
        const dy = (top + cornerR - fy) / cornerR;
        return dx * dx + dy * dy <= 1;
      }
      if (nearRight) {
        const dx = (fx - (right - cornerR)) / cornerR;
        const dy = (top + cornerR - fy) / cornerR;
        return dx * dx + dy * dy <= 1;
      }
    }
    return fx >= left && fx <= right;
  }

  // Tapering point at the bottom of the shield.
  const t = (fy - taperStart) / (bottom - taperStart);
  const center = (left + right) / 2;
  const curLeft = left + (center - left) * t;
  const curRight = right - (right - center) * t;
  return fx >= curLeft && fx <= curRight;
}

function buildTextMask(word) {
  const cols = word.length * 5 + (word.length - 1) * 1;
  const rows = 7;
  const mask = Array.from({ length: rows }, () => new Array(cols).fill(false));
  let colOffset = 0;
  for (const letter of word) {
    const glyph = FONT[letter];
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < 5; c++) {
        mask[r][colOffset + c] = glyph[r][c] === '1';
      }
    }
    colOffset += 6;
  }
  return { mask, cols, rows };
}

function generateIcon(size) {
  const pixels = Buffer.alloc(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const idx = (y * size + x) * 4;
      const inShield = isInShield(x, y, size);
      const [r, g, b] = inShield ? CRIMSON : BLACK;
      pixels[idx] = r;
      pixels[idx + 1] = g;
      pixels[idx + 2] = b;
      pixels[idx + 3] = 255;
    }
  }

  // Center "AFS" in white within the upper-middle of the shield.
  const { mask, cols, rows } = buildTextMask('AFS');
  const scale = Math.max(1, Math.floor((size * 0.5) / cols));
  const textWidth = cols * scale;
  const textHeight = rows * scale;
  const startX = Math.round((size - textWidth) / 2);
  const startY = Math.round(size * 0.42 - textHeight / 2);

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (!mask[r][c]) continue;
      for (let sy = 0; sy < scale; sy++) {
        for (let sx = 0; sx < scale; sx++) {
          const px = startX + c * scale + sx;
          const py = startY + r * scale + sy;
          if (px < 0 || py < 0 || px >= size || py >= size) continue;
          const idx = (py * size + px) * 4;
          pixels[idx] = WHITE[0];
          pixels[idx + 1] = WHITE[1];
          pixels[idx + 2] = WHITE[2];
          pixels[idx + 3] = 255;
        }
      }
    }
  }

  // Raw scanlines, each prefixed with filter-type byte 0 (None).
  const raw = Buffer.alloc(size * (1 + size * 4));
  for (let y = 0; y < size; y++) {
    const rowStart = y * (1 + size * 4);
    raw[rowStart] = 0;
    pixels.copy(raw, rowStart + 1, y * size * 4, (y + 1) * size * 4);
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type: RGBA
  ihdr[10] = 0; // compression
  ihdr[11] = 0; // filter
  ihdr[12] = 0; // interlace

  const idat = zlib.deflateSync(raw);

  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  return Buffer.concat([
    signature,
    chunk('IHDR', ihdr),
    chunk('IDAT', idat),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

const outDir = path.join(__dirname, '..', 'public');
for (const size of [192, 512]) {
  const png = generateIcon(size);
  const outPath = path.join(outDir, `employee-icon-${size}.png`);
  fs.writeFileSync(outPath, png);
  console.log(`Wrote ${outPath} (${png.length} bytes)`);
}
