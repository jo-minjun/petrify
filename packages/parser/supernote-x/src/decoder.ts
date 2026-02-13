import pako from 'pako';
import { PNG } from 'pngjs';
import {
  createColorMap,
  INTERNAL_PAGE_HEIGHT,
  MAX_FLATE_DECOMPRESSED_BYTES,
  PALETTE_TRANSPARENT,
  RLE_CONTINUATION_BIT,
  RLE_SPECIAL_LENGTH,
  RLE_SPECIAL_LENGTH_BLANK,
  RLE_SPECIAL_LENGTH_MARKER,
} from './constants.js';
import { ParseError } from './exceptions.js';

export function decodeRattaRle(
  data: Uint8Array,
  width: number,
  height: number,
  isX2: boolean,
  allBlank = false,
): Uint8Array {
  const colorMap = createColorMap(isX2);
  const totalPixels = width * height;
  const pixels = new Uint8Array(totalPixels);
  pixels.fill(PALETTE_TRANSPARENT);

  let pixelIdx = 0;
  let dataIdx = 0;
  let holderColor = -1;
  let holderLength = -1;

  const emit = (colorCode: number, count: number) => {
    const gray = colorMap.get(colorCode) ?? colorCode;
    const end = Math.min(pixelIdx + count, totalPixels);
    pixels.fill(gray, pixelIdx, end);
    pixelIdx = end;
  };

  while (dataIdx + 1 < data.length && pixelIdx < totalPixels) {
    const colorCode = data[dataIdx++];
    let length = data[dataIdx++];
    let dataPushed = false;

    if (holderColor >= 0) {
      const prevColor = holderColor;
      const prevLength = holderLength;
      holderColor = -1;
      holderLength = -1;

      if (colorCode === prevColor) {
        length = 1 + length + (((prevLength & 0x7f) + 1) << 7);
        emit(colorCode, length);
        dataPushed = true;
      } else {
        const adjustedLength = ((prevLength & 0x7f) + 1) << 7;
        emit(prevColor, adjustedLength);
      }
    }

    if (!dataPushed) {
      if (length === RLE_SPECIAL_LENGTH_MARKER) {
        length = allBlank ? RLE_SPECIAL_LENGTH_BLANK : RLE_SPECIAL_LENGTH;
        emit(colorCode, length);
      } else if ((length & RLE_CONTINUATION_BIT) !== 0) {
        holderColor = colorCode;
        holderLength = length;
      } else {
        length = length + 1;
        emit(colorCode, length);
      }
    }
  }

  if (holderColor >= 0 && pixelIdx < totalPixels) {
    emit(holderColor, totalPixels - pixelIdx);
  }

  return pixels;
}

export function decodePng(data: Uint8Array, width: number, height: number): Uint8Array {
  const png = PNG.sync.read(Buffer.from(data));
  const pixels = new Uint8Array(width * height);
  pixels.fill(PALETTE_TRANSPARENT);

  const srcPixels = Math.min(png.width * png.height, width * height);
  const channels = png.data.length / (png.width * png.height);

  for (let i = 0; i < srcPixels; i++) {
    const offset = i * channels;
    const gray = png.data[offset];
    const alpha = channels >= 4 ? png.data[offset + 3] : 255;
    if (alpha > 0) {
      pixels[i] = gray;
    }
  }

  return pixels;
}

export function decodeFlate(data: Uint8Array, width: number, height: number): Uint8Array {
  const inflater = new pako.Inflate();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;

  inflater.onData = (chunk: pako.Data) => {
    let normalized: Uint8Array;
    if (chunk instanceof Uint8Array) {
      normalized = chunk;
    } else if (chunk instanceof ArrayBuffer) {
      normalized = new Uint8Array(chunk);
    } else {
      normalized = Uint8Array.from(chunk);
    }
    totalBytes += normalized.length;
    if (totalBytes > MAX_FLATE_DECOMPRESSED_BYTES) {
      throw new ParseError(`Flate decompressed data exceeds ${MAX_FLATE_DECOMPRESSED_BYTES} bytes`);
    }
    chunks.push(normalized);
  };

  try {
    inflater.push(data, true);
  } catch (e) {
    if (e instanceof ParseError) {
      throw e;
    }
    const message = e instanceof Error ? e.message : String(e);
    throw new ParseError(`Failed to inflate flate layer: ${message}`);
  }

  if (inflater.err) {
    throw new ParseError(`Failed to inflate flate layer: ${inflater.msg ?? 'unknown error'}`);
  }

  const decompressed = new Uint8Array(totalBytes);
  let chunkOffset = 0;
  for (const chunk of chunks) {
    decompressed.set(chunk, chunkOffset);
    chunkOffset += chunk.length;
  }

  const pixelCount = Math.floor(decompressed.length / 2);
  const view = new DataView(decompressed.buffer, decompressed.byteOffset, decompressed.byteLength);
  const rawPixels = new Uint16Array(pixelCount);
  for (let i = 0; i < pixelCount; i++) {
    rawPixels[i] = view.getUint16(i * 2, true);
  }
  rawPixels.reverse();

  const pixels = new Uint8Array(width * height);
  pixels.fill(PALETTE_TRANSPARENT);

  let outIdx = 0;
  for (let i = 0; i < rawPixels.length && outIdx < width * height; i++) {
    // Flate layers may include padded columns; keep only the visible page columns.
    const column = i % width;
    if (column < INTERNAL_PAGE_HEIGHT) {
      const code = rawPixels[i];
      if (code === 0x0000) pixels[outIdx] = 0x00;
      else if (code === 0x2104) pixels[outIdx] = 0x9d;
      else if (code === 0xe1e2) pixels[outIdx] = 0xc9;
      else pixels[outIdx] = PALETTE_TRANSPARENT;
      outIdx++;
    }
  }

  return pixels;
}
