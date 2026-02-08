import { describe, expect, it } from 'vitest';
import { InvalidFileFormatError, ParseError } from '../src/exceptions.js';
import { NoteParser } from '../src/parser.js';
import { buildTestNote } from './test-helpers.js';

describe('NoteParser', () => {
  describe('signature validation', () => {
    it('rejects non-note file type', async () => {
      const data = new TextEncoder().encode('markSN_FILE_VER_20230015').buffer;
      const parser = new NoteParser();
      await expect(parser.parse(data)).rejects.toThrow(InvalidFileFormatError);
    });

    it('rejects invalid signature pattern', async () => {
      const data = new TextEncoder().encode('noteINVALID_SIGNATURE_X').buffer;
      const parser = new NoteParser();
      await expect(parser.parse(data)).rejects.toThrow(InvalidFileFormatError);
    });

    it('rejects buffer too small for signature', async () => {
      const parser = new NoteParser();
      await expect(parser.parse(new ArrayBuffer(10))).rejects.toThrow(InvalidFileFormatError);
    });
  });

  describe('page parsing', () => {
    it('parses single page note', async () => {
      const data = buildTestNote({ pages: [{ pageId: 'p1' }] });
      const parser = new NoteParser();
      const note = await parser.parse(data);

      expect(note.pages).toHaveLength(1);
      expect(note.pages[0].id).toBe('p1');
      expect(note.pages[0].order).toBe(0);
      expect(note.pages[0].imageData.length).toBeGreaterThan(0);
      // Verify PNG magic bytes
      expect(note.pages[0].imageData[0]).toBe(0x89);
      expect(note.pages[0].imageData[1]).toBe(0x50);
    });

    it('parses multi-page note', async () => {
      const data = buildTestNote({
        pages: [{ pageId: 'first' }, { pageId: 'second' }],
      });
      const parser = new NoteParser();
      const note = await parser.parse(data);

      expect(note.pages).toHaveLength(2);
      expect(note.pages[0].id).toBe('first');
      expect(note.pages[0].order).toBe(0);
      expect(note.pages[1].id).toBe('second');
      expect(note.pages[1].order).toBe(1);
    });
  });

  describe('footer parsing', () => {
    it('throws ParseError when footer address is out of bounds', async () => {
      const encoder = new TextEncoder();
      const prefix = encoder.encode('noteSN_FILE_VER_20230015');
      const buf = new Uint8Array(prefix.length + 4);
      buf.set(prefix, 0);
      // Footer address pointing beyond file
      new DataView(buf.buffer).setUint32(prefix.length, 0xffffffff, true);

      const parser = new NoteParser();
      await expect(parser.parse(buf.buffer)).rejects.toThrow(ParseError);
    });
  });
});
