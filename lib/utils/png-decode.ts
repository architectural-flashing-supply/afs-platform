// Minimal, dependency-free PNG pixel decoder — mirrors simple-pdf.ts's own
// "hand-write the bytes, no library" approach. Only supports what
// lib/utils/bid-document-pdf.ts actually needs to embed the real AFS logo
// asset (public/afs-logo-512.png): 8-bit depth, non-interlaced, truecolor
// (RGB) or truecolor-with-alpha (RGBA) — the only PNG shapes real image
// editors write by default. Palette (color type 3) and grayscale (0/4) PNGs
// throw rather than silently producing garbage pixels.
import { inflateSync } from 'zlib';

export interface DecodedPng {
  width: number;
  height: number;
  /** Raw, unfiltered RGB pixel bytes, row-major, 3 bytes/pixel. */
  rgb: Buffer;
  /** Raw, unfiltered alpha bytes, row-major, 1 byte/pixel — null if the source PNG has no alpha channel. */
  alpha: Buffer | null;
}

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

function paethPredictor(a: number, b: number, c: number): number {
  const p = a + b - c;
  const pa = Math.abs(p - a);
  const pb = Math.abs(p - b);
  const pc = Math.abs(p - c);
  if (pa <= pb && pa <= pc) return a;
  if (pb <= pc) return b;
  return c;
}

/** Reverses PNG's per-scanline adaptive filtering (spec §9.2/§9.3) to produce raw pixel bytes. */
function unfilter(raw: Buffer, width: number, height: number, bytesPerPixel: number): Buffer {
  const stride = width * bytesPerPixel;
  const pixels = Buffer.alloc(height * stride);
  let rawOffset = 0;

  for (let row = 0; row < height; row++) {
    const filterType = raw[rawOffset];
    rawOffset += 1;
    const rowStart = row * stride;
    const prevRowStart = (row - 1) * stride;

    for (let i = 0; i < stride; i++) {
      const x = raw[rawOffset + i];
      const a = i >= bytesPerPixel ? pixels[rowStart + i - bytesPerPixel] : 0;
      const b = row > 0 ? pixels[prevRowStart + i] : 0;
      const c = row > 0 && i >= bytesPerPixel ? pixels[prevRowStart + i - bytesPerPixel] : 0;

      let value: number;
      switch (filterType) {
        case 0:
          value = x;
          break;
        case 1:
          value = x + a;
          break;
        case 2:
          value = x + b;
          break;
        case 3:
          value = x + Math.floor((a + b) / 2);
          break;
        case 4:
          value = x + paethPredictor(a, b, c);
          break;
        default:
          throw new Error(`Unsupported PNG filter type: ${filterType}`);
      }
      pixels[rowStart + i] = value & 0xff;
    }
    rawOffset += stride;
  }

  return pixels;
}

export function decodePng(buffer: Buffer): DecodedPng {
  if (!buffer.subarray(0, 8).equals(PNG_SIGNATURE)) {
    throw new Error('Not a PNG file.');
  }

  let offset = 8;
  let width = 0;
  let height = 0;
  let bitDepth = 0;
  let colorType = 0;
  let interlace = 0;
  const idatChunks: Buffer[] = [];

  while (offset < buffer.length) {
    const length = buffer.readUInt32BE(offset);
    const type = buffer.toString('ascii', offset + 4, offset + 8);
    const dataStart = offset + 8;
    const data = buffer.subarray(dataStart, dataStart + length);

    if (type === 'IHDR') {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      bitDepth = data.readUInt8(8);
      colorType = data.readUInt8(9);
      interlace = data.readUInt8(12);
    } else if (type === 'IDAT') {
      idatChunks.push(data);
    } else if (type === 'IEND') {
      break;
    }
    // Every chunk (regardless of type) is length + type(4) + data + CRC(4).
    offset = dataStart + length + 4;
  }

  if (bitDepth !== 8) {
    throw new Error(`Unsupported PNG bit depth: ${bitDepth} (only 8-bit is supported).`);
  }
  if (interlace !== 0) {
    throw new Error('Interlaced PNG is not supported.');
  }
  if (colorType !== 2 && colorType !== 6) {
    throw new Error(`Unsupported PNG color type: ${colorType} (only RGB/RGBA is supported).`);
  }

  const channels = colorType === 6 ? 4 : 3;
  const raw = inflateSync(Buffer.concat(idatChunks));
  const pixels = unfilter(raw, width, height, channels);

  if (channels === 3) {
    return { width, height, rgb: pixels, alpha: null };
  }

  const pixelCount = width * height;
  const rgb = Buffer.alloc(pixelCount * 3);
  const alpha = Buffer.alloc(pixelCount);
  for (let p = 0; p < pixelCount; p++) {
    rgb[p * 3] = pixels[p * 4];
    rgb[p * 3 + 1] = pixels[p * 4 + 1];
    rgb[p * 3 + 2] = pixels[p * 4 + 2];
    alpha[p] = pixels[p * 4 + 3];
  }
  return { width, height, rgb, alpha };
}

/**
 * Box-average downsample by an integer factor. The AFS logo source asset is
 * 1024×1024 (see public/afs-logo-512.png) — far more resolution than a
 * letterhead-sized print logo needs, so bid-document-pdf.ts downsamples it
 * once (factor 4 → 256×256) before embedding, keeping the generated PDF's
 * file size reasonable. Only exact integer factors are supported — the one
 * real caller always passes a factor that evenly divides the source
 * dimensions, so a partial-block remainder case is not needed.
 */
export function downsamplePngBoxFilter(png: DecodedPng, factor: number): DecodedPng {
  if (factor <= 1) return png;
  const newWidth = Math.floor(png.width / factor);
  const newHeight = Math.floor(png.height / factor);
  const area = factor * factor;

  const outRgb = Buffer.alloc(newWidth * newHeight * 3);
  const outAlpha = png.alpha ? Buffer.alloc(newWidth * newHeight) : null;

  for (let oy = 0; oy < newHeight; oy++) {
    for (let ox = 0; ox < newWidth; ox++) {
      let rSum = 0;
      let gSum = 0;
      let bSum = 0;
      let aSum = 0;
      for (let fy = 0; fy < factor; fy++) {
        const srcY = oy * factor + fy;
        for (let fx = 0; fx < factor; fx++) {
          const srcX = ox * factor + fx;
          const srcPixel = srcY * png.width + srcX;
          const srcIdx = srcPixel * 3;
          rSum += png.rgb[srcIdx];
          gSum += png.rgb[srcIdx + 1];
          bSum += png.rgb[srcIdx + 2];
          if (png.alpha) aSum += png.alpha[srcPixel];
        }
      }
      const outPixel = oy * newWidth + ox;
      const outIdx = outPixel * 3;
      outRgb[outIdx] = Math.round(rSum / area);
      outRgb[outIdx + 1] = Math.round(gSum / area);
      outRgb[outIdx + 2] = Math.round(bSum / area);
      if (outAlpha) outAlpha[outPixel] = Math.round(aSum / area);
    }
  }

  return { width: newWidth, height: newHeight, rgb: outRgb, alpha: outAlpha };
}
