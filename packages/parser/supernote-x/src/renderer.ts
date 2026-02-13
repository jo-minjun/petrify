import { PNG } from 'pngjs';
import { PALETTE_TRANSPARENT } from './constants.js';

export interface LayerBitmap {
  readonly pixels: Uint8Array;
  readonly width: number;
  readonly height: number;
}

export function compositeLayers(
  layers: readonly LayerBitmap[],
  width: number,
  height: number,
): Uint8Array {
  const result = new Uint8Array(width * height);
  result.fill(PALETTE_TRANSPARENT);

  for (const layer of layers) {
    for (let i = 0; i < width * height; i++) {
      const pixel = layer.pixels[i];
      if (pixel !== PALETTE_TRANSPARENT) {
        result[i] = pixel;
      }
    }
  }

  return result;
}

export function grayscaleToPng(pixels: Uint8Array, width: number, height: number): Uint8Array {
  const png = new PNG({ width, height });

  for (let i = 0; i < width * height; i++) {
    const gray = pixels[i];
    png.data[i * 4] = gray;
    png.data[i * 4 + 1] = gray;
    png.data[i * 4 + 2] = gray;
    png.data[i * 4 + 3] = 255;
  }

  return new Uint8Array(PNG.sync.write(png));
}
