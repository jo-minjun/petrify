import pako from 'pako';
import { describe, expect, it } from 'vitest';
import { decodeFlate, decodeRattaRle } from '../src/decoder.js';
import { ParseError } from '../src/exceptions.js';

describe('decodeRattaRle', () => {
  it('rejects an incomplete color-length pair', () => {
    expect(() => decodeRattaRle(new Uint8Array([0x61]), 1, 1, false)).toThrow(ParseError);
  });
  it('decodes simple length+1 encoding', () => {
    // colorcode=0x61(BLACK->0x00), length=0x02 -> 3 pixels
    // colorcode=0x62(BG->0xff), length=0x04 -> 5 pixels
    const data = new Uint8Array([0x61, 0x02, 0x62, 0x04]);
    const result = decodeRattaRle(data, 8, 1, false);
    expect(Array.from(result)).toEqual([0x00, 0x00, 0x00, 0xff, 0xff, 0xff, 0xff, 0xff]);
  });

  it('decodes special length marker (0xFF) as 0x4000 pixels', () => {
    const data = new Uint8Array([0x62, 0xff]);
    const result = decodeRattaRle(data, 0x4000, 1, false);
    expect(result.length).toBe(0x4000);
    expect(result.every((v) => v === 0xff)).toBe(true);
  });

  it('decodes special length marker with allBlank as 0x400 pixels', () => {
    const data = new Uint8Array([0x62, 0xff]);
    const result = decodeRattaRle(data, 0x400, 1, false, true);
    expect(result.length).toBe(0x400);
    expect(result.every((v) => v === 0xff)).toBe(true);
  });

  it('decodes continuation bit (holder mechanism)', () => {
    // First pair: color=0x61, length=0x80 (continuation bit set)
    // Second pair: same color=0x61, length=0x05
    // Combined: 1 + 5 + (((0x80 & 0x7F) + 1) << 7) = 1 + 5 + 128 = 134
    const data = new Uint8Array([0x61, 0x80, 0x61, 0x05]);
    const result = decodeRattaRle(data, 134, 1, false);
    expect(result.length).toBe(134);
    expect(result.every((v) => v === 0x00)).toBe(true);
  });

  it('decodes continuation with different color (flush holder)', () => {
    // First pair: color=0x61, length=0x80 -> holder
    // Second pair: color=0x62, length=0x02
    // Holder flush: 0x61 with length ((0x80 & 0x7F) + 1) << 7 = 128 pixels
    // Then: 0x62 with length 0x02 + 1 = 3 pixels
    const data = new Uint8Array([0x61, 0x80, 0x62, 0x02]);
    const result = decodeRattaRle(data, 131, 1, false);
    expect(result.slice(0, 128).every((v) => v === 0x00)).toBe(true);
    expect(result.slice(128, 131).every((v) => v === 0xff)).toBe(true);
  });

  it('maps X-series color codes correctly', () => {
    // 0x63->DARK_GRAY(0x9d), 0x64->GRAY(0xc9), 0x65->WHITE(0xfe)
    const data = new Uint8Array([0x63, 0x00, 0x64, 0x00, 0x65, 0x00]);
    const result = decodeRattaRle(data, 3, 1, false);
    expect(Array.from(result)).toEqual([0x9d, 0xc9, 0xfe]);
  });

  it('maps X2-series color codes correctly', () => {
    // X2: 0x9d->DARK_GRAY(0x9d), 0xc9->GRAY(0xc9)
    // X2 compat: 0x63->DARK_GRAY_COMPAT(0x30), 0x64->GRAY_COMPAT(0x50)
    const data = new Uint8Array([0x9d, 0x00, 0xc9, 0x00, 0x63, 0x00, 0x64, 0x00]);
    const result = decodeRattaRle(data, 4, 1, true);
    expect(Array.from(result)).toEqual([0x9d, 0xc9, 0x30, 0x50]);
  });

  it('rejects a truncated stream instead of filling missing pixels with transparency', () => {
    const data = new Uint8Array([0x61, 0x01]); // 2 BLACK pixels
    expect(() => decodeRattaRle(data, 5, 1, false)).toThrow(ParseError);
  });

  it.each([
    new Uint8Array([0x61, 0x05]),
    new Uint8Array([0x61, 0x04, 0x62, 0]),
  ])('rejects runs beyond the expected bitmap size: %j', (data) => {
    expect(() => decodeRattaRle(data, 5, 1, false)).toThrow(ParseError);
  });

  it('rejects a trailing continuation that cannot represent the remaining pixels', () => {
    expect(() => decodeRattaRle(new Uint8Array([0x61, 0x80]), 3, 1, false)).toThrow(ParseError);
  });

  it('rejects an extra continuation after the bitmap is complete', () => {
    expect(() => decodeRattaRle(new Uint8Array([0x61, 4, 0x62, 0x80]), 5, 1, false)).toThrow(
      ParseError,
    );
  });

  it('decodes a trailing continuation matching the remaining size', () => {
    expect(Array.from(decodeRattaRle(new Uint8Array([0x61, 0x81]), 4, 1, false))).toEqual([
      0, 0, 0, 0,
    ]);
  });
});

describe('decodeFlate', () => {
  it.each([
    0, 16,
  ])('rotates an asymmetric bitmap clockwise and removes %i padded bottom rows', (padding) => {
    const stride = 3 + padding;
    const data = new Uint8Array(2 * stride * 2);
    data.fill(0xff);
    const view = new DataView(data.buffer);
    [0, 0x2104, 0xe1e2].forEach((code, y) => {
      view.setUint16(y * 2, code, true);
    });
    [0xe1e2, 0, 0x2104].forEach((code, y) => {
      view.setUint16((stride + y) * 2, code, true);
    });
    expect(Array.from(decodeFlate(pako.deflate(data), 2, 3))).toEqual([
      0xc9, 0, 0, 0x9d, 0x9d, 0xc9,
    ]);
  });

  it.each([1, 10, 14])('rejects incompatible decompressed lengths (%i bytes)', (length) => {
    expect(() => decodeFlate(pako.deflate(new Uint8Array(length)), 2, 3)).toThrow(ParseError);
  });
  it('throws ParseError when decompressed payload exceeds safety limit', () => {
    const oversized = new Uint8Array(20 * 1024 * 1024 + 2);
    const compressed = pako.deflate(oversized);
    const decode = () => decodeFlate(compressed, 1404, 1872);

    expect(decode).toThrow(ParseError);
    expect(decode).toThrow('exceeds');
  });
});
