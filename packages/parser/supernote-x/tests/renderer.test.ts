import { PNG } from 'pngjs';
import { describe, expect, it } from 'vitest';
import { compositeLayers, grayscaleToPng } from '../src/renderer.js';

describe('compositeLayers', () => {
  it('returns white canvas for no layers', () => {
    const result = compositeLayers([], 2, 2);
    expect(Array.from(result)).toEqual([0xff, 0xff, 0xff, 0xff]);
  });

  it('composites single layer over white background', () => {
    const layer = { pixels: new Uint8Array([0x00, 0xff, 0x9d, 0xff]), width: 2, height: 2 };
    const result = compositeLayers([layer], 2, 2);
    expect(Array.from(result)).toEqual([0x00, 0xff, 0x9d, 0xff]);
  });

  it('upper layer overwrites lower layer (non-transparent pixels)', () => {
    const bottom = { pixels: new Uint8Array([0x00, 0x00, 0x00, 0x00]), width: 2, height: 2 };
    const top = { pixels: new Uint8Array([0x9d, 0xff, 0xff, 0xc9]), width: 2, height: 2 };
    const result = compositeLayers([bottom, top], 2, 2);
    expect(Array.from(result)).toEqual([0x9d, 0x00, 0x00, 0xc9]);
  });
});

describe('grayscaleToPng', () => {
  it('produces valid PNG data', () => {
    const pixels = new Uint8Array([0x00, 0xff, 0x9d, 0xc9]);
    const pngData = grayscaleToPng(pixels, 2, 2);

    expect(pngData[0]).toBe(0x89);
    expect(pngData[1]).toBe(0x50);
    expect(pngData[2]).toBe(0x4e);
    expect(pngData[3]).toBe(0x47);

    const decoded = PNG.sync.read(Buffer.from(pngData));
    expect(decoded.width).toBe(2);
    expect(decoded.height).toBe(2);
    expect(decoded.data[0]).toBe(0x00);
    expect(decoded.data[3]).toBe(0xff);
  });
});
