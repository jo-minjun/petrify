import JSZip from 'jszip';
import { describe, expect, it } from 'vitest';
import { InvalidFileFormatError, ParseError } from '../src/exceptions';
import { NoteParser } from '../src/parser';

function createMockZip(options: {
  noteInfo?: Record<string, unknown>;
  pageList?: Array<{ id: string; order: number; [key: string]: unknown }>;
  screenshots?: Record<string, Uint8Array>;
}): Promise<ArrayBuffer> {
  const zip = new JSZip();

  if (options.noteInfo) {
    zip.file('abc_NoteFileInfo.json', JSON.stringify(options.noteInfo));
  }

  if (options.pageList) {
    zip.file('abc_PageListFileInfo.json', JSON.stringify(options.pageList));
  }

  if (options.screenshots) {
    for (const [name, data] of Object.entries(options.screenshots)) {
      zip.file(name, data);
    }
  }

  return zip.generateAsync({ type: 'arraybuffer' });
}

describe('NoteParser', () => {
  describe('parse', () => {
    it('유효하지 않은 ZIP 파일이면 InvalidFileFormatError', async () => {
      const parser = new NoteParser();
      const invalidData = new ArrayBuffer(10);

      await expect(parser.parse(invalidData)).rejects.toThrow(InvalidFileFormatError);
    });

    it('NoteFileInfo에서 제목과 날짜를 파싱', async () => {
      const data = await createMockZip({
        noteInfo: {
          fileName: 'My Note',
          creationTime: 1700000000000,
          lastModifiedTime: 1700001000000,
        },
        pageList: [{ id: 'page-1', order: 0 }],
        screenshots: {
          'screenshotBmp_page-1.png': new Uint8Array([137, 80, 78, 71]),
        },
      });

      const parser = new NoteParser();
      const note = await parser.parse(data);

      expect(note.title).toBe('My Note');
      expect(note.createdAt).toEqual(new Date(1700000000000));
      expect(note.modifiedAt).toEqual(new Date(1700001000000));
    });

    it('NoteFileInfo가 없으면 기본값 사용', async () => {
      const data = await createMockZip({
        pageList: [{ id: 'page-1', order: 0 }],
        screenshots: {
          'screenshotBmp_page-1.png': new Uint8Array([137, 80, 78, 71]),
        },
      });

      const parser = new NoteParser();
      const note = await parser.parse(data);

      expect(note.title).toBe('Untitled');
    });
  });

  describe('PageListFileInfo 파싱', () => {
    it('PageListFileInfo가 없으면 ParseError', async () => {
      const data = await createMockZip({
        noteInfo: { fileName: 'Test' },
      });

      const parser = new NoteParser();
      await expect(parser.parse(data)).rejects.toThrow(ParseError);
      await expect(parser.parse(data)).rejects.toThrow('PageListFileInfo.json not found');
    });

    it('order 필드 기준으로 페이지 정렬', async () => {
      const data = await createMockZip({
        pageList: [
          { id: 'page-b', order: 2 },
          { id: 'page-a', order: 0 },
          { id: 'page-c', order: 1 },
        ],
        screenshots: {
          'screenshotBmp_page-a.png': new Uint8Array([1, 2, 3]),
          'screenshotBmp_page-b.png': new Uint8Array([4, 5, 6]),
          'screenshotBmp_page-c.png': new Uint8Array([7, 8, 9]),
        },
      });

      const parser = new NoteParser();
      const note = await parser.parse(data);

      expect(note.pages).toHaveLength(3);
      expect(note.pages[0].id).toBe('page-a');
      expect(note.pages[0].order).toBe(0);
      expect(note.pages[1].id).toBe('page-c');
      expect(note.pages[1].order).toBe(1);
      expect(note.pages[2].id).toBe('page-b');
      expect(note.pages[2].order).toBe(2);
    });
  });

  describe('screenshotBmp 추출', () => {
    it('pageId로 screenshotBmp 파일 매핑', async () => {
      const imageBytes = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);
      const data = await createMockZip({
        pageList: [{ id: 'abc-123', order: 0 }],
        screenshots: {
          'screenshotBmp_abc-123.png': imageBytes,
        },
      });

      const parser = new NoteParser();
      const note = await parser.parse(data);

      expect(note.pages).toHaveLength(1);
      expect(note.pages[0].id).toBe('abc-123');
      expect(note.pages[0].imageData).toEqual(imageBytes);
      expect(note.pages[0].width).toBe(1440);
      expect(note.pages[0].height).toBe(1920);
      expect(note.pages[0].order).toBe(0);
    });

    it('screenshotBmp가 없는 페이지는 스킵', async () => {
      const img = new Uint8Array([1, 2, 3]);
      const data = await createMockZip({
        pageList: [
          { id: 'missing-page', order: 0 },
          { id: 'valid-page', order: 1 },
        ],
        screenshots: {
          'screenshotBmp_valid-page.png': img,
        },
      });

      const parser = new NoteParser();
      const note = await parser.parse(data);

      expect(note.pages).toHaveLength(1);
      expect(note.pages[0].id).toBe('valid-page');
    });

    it('다중 페이지에서 각각의 screenshotBmp 추출', async () => {
      const img1 = new Uint8Array([1, 1, 1]);
      const img2 = new Uint8Array([2, 2, 2]);

      const data = await createMockZip({
        pageList: [
          { id: 'page-1', order: 0 },
          { id: 'page-2', order: 1 },
        ],
        screenshots: {
          'screenshotBmp_page-1.png': img1,
          'screenshotBmp_page-2.png': img2,
        },
      });

      const parser = new NoteParser();
      const note = await parser.parse(data);

      expect(note.pages).toHaveLength(2);
      expect(note.pages[0].imageData).toEqual(img1);
      expect(note.pages[1].imageData).toEqual(img2);
    });
  });
});
