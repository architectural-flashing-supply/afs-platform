// One-off asset generator for the three PWA icon/manifest sets (afs-fl-010):
// root site (red), /field/contractor (black), /field/shop (white).
//
// No image library (sharp/canvas) is installed in this project -- see
// scripts/generate-employee-icons.js for the established precedent of doing
// PNG encode/decode by hand with Node's built-in zlib. This script follows
// the same pattern, plus a PNG *decoder* (to read the real afs-logo-512.png
// mark) and a minimal multi-image .ico encoder for the root favicon.
//
// Run once with: node scripts/generate-pwa-icons.js
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const PUBLIC_DIR = path.join(__dirname, '..', 'public');
const SOURCE_LOGO = path.join(PUBLIC_DIR, 'afs-logo-512.png');

// ---- PNG decode (RGBA only, the only color type afs-logo-512.png uses) ----

function decodePng(filePath) {
  const buf = fs.readFileSync(filePath);
  let offset = 8;
  let ihdr = null;
  const idatChunks = [];
  while (offset < buf.length) {
    const len = buf.readUInt32BE(offset);
    const type = buf.toString('ascii', offset + 4, offset + 8);
    const data = buf.slice(offset + 8, offset + 8 + len);
    if (type === 'IHDR') {
      ihdr = { width: data.readUInt32BE(0), height: data.readUInt32BE(4), bitDepth: data[8], colorType: data[9] };
    }
    if (type === 'IDAT') idatChunks.push(data);
    offset += 8 + len + 4;
    if (type === 'IEND') break;
  }
  if (ihdr.bitDepth !== 8 || ihdr.colorType !== 6) {
    throw new Error(`${filePath}: expected 8-bit RGBA PNG, got bitDepth=${ihdr.bitDepth} colorType=${ihdr.colorType}`);
  }
  const raw = zlib.inflateSync(Buffer.concat(idatChunks));
  const bpp = 4;
  const stride = ihdr.width * bpp;
  const pixels = Buffer.alloc(ihdr.width * ihdr.height * 4);
  const prevRow = Buffer.alloc(stride);
  let pos = 0;
  for (let y = 0; y < ihdr.height; y++) {
    const filterType = raw[pos];
    pos++;
    const row = Buffer.alloc(stride);
    for (let x = 0; x < stride; x++) {
      const rawX = raw[pos + x];
      const a = x >= bpp ? row[x - bpp] : 0;
      const b = prevRow[x];
      const c = x >= bpp ? prevRow[x - bpp] : 0;
      let val;
      if (filterType === 0) val = rawX;
      else if (filterType === 1) val = (rawX + a) & 0xff;
      else if (filterType === 2) val = (rawX + b) & 0xff;
      else if (filterType === 3) val = (rawX + Math.floor((a + b) / 2)) & 0xff;
      else if (filterType === 4) {
        const p = a + b - c;
        const pa = Math.abs(p - a);
        const pb = Math.abs(p - b);
        const pc = Math.abs(p - c);
        const pr = pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
        val = (rawX + pr) & 0xff;
      } else {
        throw new Error(`Unsupported PNG filter type ${filterType}`);
      }
      row[x] = val;
    }
    row.copy(pixels, y * stride);
    row.copy(prevRow);
    pos += stride;
  }
  return { width: ihdr.width, height: ihdr.height, pixels };
}

// ---- PNG encode (RGBA, filter-none, matches generate-employee-icons.js) ----

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

function encodePng(width, height, pixels) {
  const raw = Buffer.alloc(height * (1 + width * 4));
  for (let y = 0; y < height; y++) {
    const rowStart = y * (1 + width * 4);
    raw[rowStart] = 0;
    pixels.copy(raw, rowStart + 1, y * width * 4, (y + 1) * width * 4);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;
  const idat = zlib.deflateSync(raw);
  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  return Buffer.concat([signature, chunk('IHDR', ihdr), chunk('IDAT', idat), chunk('IEND', Buffer.alloc(0))]);
}

// ---- Compositing: badge cropped to its bounding box, scaled and centered
// on a square canvas, alpha-blended over a solid baked-in background. ----

function findBBox(src) {
  const { width, height, pixels } = src;
  let minX = width, maxX = -1, minY = height, maxY = -1;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const a = pixels[(y * width + x) * 4 + 3];
      if (a > 10) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  return { minX, maxX, minY, maxY };
}

function sampleSrc(src, fx, fy) {
  // fx, fy in [0,1) source-normalized coords; nearest-neighbor sample.
  const x = Math.min(src.width - 1, Math.max(0, Math.floor(fx * src.width)));
  const y = Math.min(src.height - 1, Math.max(0, Math.floor(fy * src.height)));
  const idx = (y * src.width + x) * 4;
  return [src.pixels[idx], src.pixels[idx + 1], src.pixels[idx + 2], src.pixels[idx + 3]];
}

// Composite the source crop rect (in source pixel space) into a size x size
// canvas filled with bg, scaled to occupy `contentFrac` of the canvas width,
// centered. Uses NxN supersampling per destination pixel for downsample
// quality (the source is 1024px; icons are much smaller).
function composite(src, crop, size, bg, contentFrac = 0.82, supersample = 4) {
  const [bgR, bgG, bgB] = bg;
  const pixels = Buffer.alloc(size * size * 4);
  for (let i = 0; i < size * size; i++) {
    pixels[i * 4] = bgR;
    pixels[i * 4 + 1] = bgG;
    pixels[i * 4 + 2] = bgB;
    pixels[i * 4 + 3] = 255;
  }

  const cropW = crop.maxX - crop.minX;
  const cropH = crop.maxY - crop.minY;
  const scale = (size * contentFrac) / cropW;
  const destW = cropW * scale;
  const destH = cropH * scale;
  const destX0 = (size - destW) / 2;
  const destY0 = (size - destH) / 2;
  const destX1 = destX0 + destW;
  const destY1 = destY0 + destH;

  const pxX0 = Math.max(0, Math.floor(destX0));
  const pxX1 = Math.min(size, Math.ceil(destX1));
  const pxY0 = Math.max(0, Math.floor(destY0));
  const pxY1 = Math.min(size, Math.ceil(destY1));

  for (let py = pxY0; py < pxY1; py++) {
    for (let px = pxX0; px < pxX1; px++) {
      let sumR = 0, sumG = 0, sumB = 0, sumA = 0, n = 0;
      for (let sy = 0; sy < supersample; sy++) {
        for (let sx = 0; sx < supersample; sx++) {
          const destPx = px + (sx + 0.5) / supersample;
          const destPy = py + (sy + 0.5) / supersample;
          if (destPx < destX0 || destPx >= destX1 || destPy < destY0 || destPy >= destY1) continue;
          const srcFx = (crop.minX + ((destPx - destX0) / destW) * cropW) / src.width;
          const srcFy = (crop.minY + ((destPy - destY0) / destH) * cropH) / src.height;
          const [r, g, b, a] = sampleSrc(src, srcFx, srcFy);
          sumR += r; sumG += g; sumB += b; sumA += a; n++;
        }
      }
      if (n === 0) continue;
      const avgR = sumR / n, avgG = sumG / n, avgB = sumB / n, avgA = (sumA / n) / 255;
      const idx = (py * size + px) * 4;
      pixels[idx] = Math.round(avgR * avgA + bgR * (1 - avgA));
      pixels[idx + 1] = Math.round(avgG * avgA + bgG * (1 - avgA));
      pixels[idx + 2] = Math.round(avgB * avgA + bgB * (1 - avgA));
      pixels[idx + 3] = 255;
    }
  }
  return pixels;
}

// ---- Minimal multi-image .ico encoder (PNG-compressed entries, Vista+) ----

function encodeIco(pngBuffers) {
  const count = pngBuffers.length;
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(count, 4);

  const dirEntries = [];
  const imageData = [];
  let offset = 6 + count * 16;
  for (const { size, png } of pngBuffers) {
    const entry = Buffer.alloc(16);
    entry[0] = size >= 256 ? 0 : size;
    entry[1] = size >= 256 ? 0 : size;
    entry[2] = 0;
    entry[3] = 0;
    entry.writeUInt16LE(1, 4);
    entry.writeUInt16LE(32, 6);
    entry.writeUInt32LE(png.length, 8);
    entry.writeUInt32LE(offset, 12);
    dirEntries.push(entry);
    imageData.push(png);
    offset += png.length;
  }
  return Buffer.concat([header, ...dirEntries, ...imageData]);
}

// ---- Build all three brands ----

const BRANDS = [
  {
    key: 'root',
    name: 'AFS',
    shortName: 'AFS',
    startUrl: '/',
    bg: [0xc0, 0x00, 0x1a], // afs-crimson, RED
    bgHex: '#C0001A',
    themeHex: '#C0001A',
    manifestFile: 'manifest.json',
    prefix: '',
  },
  {
    key: 'field-contractor',
    name: 'AFS Field',
    shortName: 'AFS Field',
    startUrl: '/field/contractor',
    bg: [0x00, 0x00, 0x00], // BLACK
    bgHex: '#000000',
    themeHex: '#000000',
    manifestFile: 'field-contractor-manifest.json',
    prefix: 'field-contractor-',
    scope: '/field/contractor',
  },
  {
    key: 'field-shop',
    name: 'AFS Shop',
    shortName: 'AFS Shop',
    startUrl: '/field/shop',
    bg: [0xff, 0xff, 0xff], // WHITE
    bgHex: '#FFFFFF',
    themeHex: '#FFFFFF',
    manifestFile: 'field-shop-manifest.json',
    prefix: 'field-shop-',
    scope: '/field/shop',
  },
];

function main() {
  const src = decodePng(SOURCE_LOGO);
  const bbox = findBBox(src);
  console.log('Source logo bbox (px):', bbox, `of ${src.width}x${src.height}`);

  for (const brand of BRANDS) {
    const icon192 = composite(src, bbox, 192, brand.bg);
    const icon512 = composite(src, bbox, 512, brand.bg);
    const appleTouch = composite(src, bbox, 180, brand.bg);

    fs.writeFileSync(path.join(PUBLIC_DIR, `${brand.prefix}icon-192.png`), encodePng(192, 192, icon192));
    fs.writeFileSync(path.join(PUBLIC_DIR, `${brand.prefix}icon-512.png`), encodePng(512, 512, icon512));
    fs.writeFileSync(
      path.join(PUBLIC_DIR, `${brand.prefix}apple-touch-icon.png`),
      encodePng(180, 180, appleTouch)
    );

    const manifest = {
      name: brand.name,
      short_name: brand.shortName,
      start_url: brand.startUrl,
      display: 'standalone',
      background_color: brand.bgHex,
      theme_color: brand.themeHex,
      icons: [
        { src: `/${brand.prefix}icon-192.png`, sizes: '192x192', type: 'image/png' },
        { src: `/${brand.prefix}icon-512.png`, sizes: '512x512', type: 'image/png' },
      ],
    };
    if (brand.scope) manifest.scope = brand.scope;
    fs.writeFileSync(path.join(PUBLIC_DIR, brand.manifestFile), JSON.stringify(manifest, null, 2) + '\n');

    console.log(`Wrote ${brand.key}: icon-192, icon-512, apple-touch-icon, ${brand.manifestFile}`);
  }

  // Root-only favicon.ico: 16/32/48 multi-size, RED background baked in.
  const rootBg = BRANDS[0].bg;
  const favSizes = [16, 32, 48];
  const favPngs = favSizes.map((size) => ({
    size,
    png: encodePng(size, size, composite(src, bbox, size, rootBg, 0.9, 4)),
  }));
  fs.writeFileSync(path.join(PUBLIC_DIR, 'favicon.ico'), encodeIco(favPngs));
  console.log('Wrote root favicon.ico (16, 32, 48)');
}

main();
