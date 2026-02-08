import pako from 'pako';
import {
  createColorMap,
  INTERNAL_PAGE_HEIGHT,
  PALETTE_TRANSPARENT,
  RLE_CONTINUATION_BIT,
  RLE_SPECIAL_LENGTH,
  RLE_SPECIAL_LENGTH_BLANK,
  RLE_SPECIAL_LENGTH_MARKER,
} from './constants.js';

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

export function decodeFlate(data: Uint8Array, width: number, height: number): Uint8Array {
  const decompressed = pako.inflate(data);
  const view = new DataView(decompressed.buffer, decompressed.byteOffset, decompressed.byteLength);

  const rawPixels: number[] = [];
  for (let i = 0; i + 1 < decompressed.length; i += 2) {
    rawPixels.push(view.getUint16(i, true));
  }
  rawPixels.reverse();

  const pixels = new Uint8Array(width * height);
  pixels.fill(PALETTE_TRANSPARENT);

  let outIdx = 0;
  for (let i = 0; i < rawPixels.length && outIdx < width * height; i++) {
    if (i % width < INTERNAL_PAGE_HEIGHT) {
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
