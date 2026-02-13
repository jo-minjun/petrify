import { describe, expect, it } from 'vitest';
import { BinaryReader } from '../src/binary-reader.js';

function makeBuffer(...bytes: number[]): ArrayBuffer {
  return new Uint8Array(bytes).buffer;
}

describe('BinaryReader', () => {
  describe('readUint32LE', () => {
    it('reads little-endian uint32', () => {
      const reader = new BinaryReader(makeBuffer(0x01, 0x00, 0x00, 0x00));
      expect(reader.readUint32LE()).toBe(1);
    });

    it('advances position by 4', () => {
      const reader = new BinaryReader(makeBuffer(0, 0, 0, 0, 1, 0, 0, 0));
      reader.readUint32LE();
      expect(reader.position).toBe(4);
      expect(reader.readUint32LE()).toBe(1);
    });
  });

  describe('readBytes', () => {
    it('returns correct slice', () => {
      const reader = new BinaryReader(makeBuffer(10, 20, 30, 40));
      expect(reader.readBytes(2)).toEqual(new Uint8Array([10, 20]));
      expect(reader.readBytes(2)).toEqual(new Uint8Array([30, 40]));
    });
  });

  describe('readString', () => {
    it('decodes UTF-8 string', () => {
      const bytes = new TextEncoder().encode('note');
      const reader = new BinaryReader(bytes.buffer);
      expect(reader.readString(4)).toBe('note');
    });
  });

  describe('seek', () => {
    it('sets read position', () => {
      const reader = new BinaryReader(makeBuffer(0, 0, 0, 0, 42, 0, 0, 0));
      reader.seek(4);
      expect(reader.readUint32LE()).toBe(42);
    });
  });

  describe('readBlock', () => {
    it('reads length-prefixed data block', () => {
      const reader = new BinaryReader(makeBuffer(3, 0, 0, 0, 0xaa, 0xbb, 0xcc));
      expect(reader.readBlock()).toEqual(new Uint8Array([0xaa, 0xbb, 0xcc]));
    });

    it('returns empty for zero-length block', () => {
      const reader = new BinaryReader(makeBuffer(0, 0, 0, 0));
      expect(reader.readBlock()).toEqual(new Uint8Array(0));
    });
  });

  describe('readBlockAsString', () => {
    it('reads block and decodes as UTF-8', () => {
      const content = '<KEY:VALUE>';
      const contentBytes = new TextEncoder().encode(content);
      const buf = new Uint8Array(4 + contentBytes.length);
      new DataView(buf.buffer).setUint32(0, contentBytes.length, true);
      buf.set(contentBytes, 4);
      const reader = new BinaryReader(buf.buffer);
      expect(reader.readBlockAsString()).toBe('<KEY:VALUE>');
    });
  });

  describe('length', () => {
    it('returns buffer byte length', () => {
      const reader = new BinaryReader(makeBuffer(1, 2, 3));
      expect(reader.length).toBe(3);
    });
  });
});
