import { describe, it, expect } from 'vitest';
import { ExcalidrawGenerator } from '../src/excalidraw-generator.js';
import type { ExcalidrawFileEntry } from '../src/excalidraw-generator.js';
import type { Note, Page } from '@petrify/core';

function createPage(overrides: Partial<Page> = {}): Page {
  return {
    id: 'page-1',
    imageData: new Uint8Array([0x89, 0x50, 0x4e, 0x47]),
    order: 0,
    width: 1440,
    height: 1920,
    ...overrides,
  };
}

function createNote(pages: Page[]): Note {
  return {
    title: 'Test',
    pages,
    createdAt: new Date(),
    modifiedAt: new Date(),
  };
}

describe('ExcalidrawGenerator', () => {
  describe('generate', () => {
    it('전체 문서 메타데이터 생성', () => {
      const note = createNote([createPage()]);
      const generator = new ExcalidrawGenerator();
      const doc = generator.generate(note);

      expect(doc.type).toBe('excalidraw');
      expect(doc.version).toBe(2);
      expect(doc.source).toBe('petrify-converter');
      expect(doc.appState).toBeDefined();
    });

    it('단일 페이지 → image element 1개 생성', () => {
      const page = createPage({ id: 'p1', order: 0 });
      const note = createNote([page]);
      const generator = new ExcalidrawGenerator();
      const doc = generator.generate(note);

      expect(doc.elements).toHaveLength(1);

      const el = doc.elements[0];
      expect(el.type).toBe('image');
      expect(el.fileId).toBe('p1');
      expect(el.x).toBe(0);
      expect(el.y).toBe(0);
      expect(el.width).toBe(1440);
      expect(el.height).toBe(1920);
      expect(el.status).toBe('saved');
      expect(el.isDeleted).toBe(false);
      expect(el.locked).toBe(false);
      expect(el.opacity).toBe(100);
      expect(el.angle).toBe(0);
      expect(el.strokeColor).toBe('transparent');
      expect(el.backgroundColor).toBe('transparent');
      expect(el.scale).toEqual([1, 1]);
    });

    it('다중 페이지 세로 배치 - y 좌표 계산', () => {
      const pages = [
        createPage({ id: 'p0', order: 0, height: 1920 }),
        createPage({ id: 'p1', order: 1, height: 1920 }),
        createPage({ id: 'p2', order: 2, height: 1920 }),
      ];
      const note = createNote(pages);
      const generator = new ExcalidrawGenerator();
      const doc = generator.generate(note);

      expect(doc.elements).toHaveLength(3);

      const gap = ExcalidrawGenerator.PAGE_GAP;
      expect(doc.elements[0].y).toBe(0);
      expect(doc.elements[1].y).toBe(1920 + gap);
      expect(doc.elements[2].y).toBe(2 * (1920 + gap));
    });

    it('페이지가 order 기준으로 정렬되어 배치', () => {
      const pages = [
        createPage({ id: 'p2', order: 2 }),
        createPage({ id: 'p0', order: 0 }),
        createPage({ id: 'p1', order: 1 }),
      ];
      const note = createNote(pages);
      const generator = new ExcalidrawGenerator();
      const doc = generator.generate(note);

      expect(doc.elements[0].fileId).toBe('p0');
      expect(doc.elements[1].fileId).toBe('p1');
      expect(doc.elements[2].fileId).toBe('p2');
    });

    it('빈 페이지 배열이면 elements와 files 모두 빈 상태', () => {
      const note = createNote([]);
      const generator = new ExcalidrawGenerator();
      const doc = generator.generate(note);

      expect(doc.elements).toHaveLength(0);
      expect(Object.keys(doc.files)).toHaveLength(0);
    });
  });

  describe('files 객체', () => {
    it('files 객체에 base64 인코딩된 dataURL 포함', () => {
      const imageData = new Uint8Array([0x89, 0x50, 0x4e, 0x47]);
      const page = createPage({ id: 'file-1', imageData });
      const note = createNote([page]);
      const generator = new ExcalidrawGenerator();
      const doc = generator.generate(note);

      const fileEntry = doc.files['file-1'] as ExcalidrawFileEntry;
      expect(fileEntry).toBeDefined();
      expect(fileEntry.mimeType).toBe('image/png');
      expect(fileEntry.id).toBe('file-1');
      expect(fileEntry.dataURL).toMatch(/^data:image\/png;base64,.+/);
      expect(typeof fileEntry.created).toBe('number');
    });

    it('dataURL의 base64 디코딩 시 원본 imageData 복원', () => {
      const imageData = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
      const page = createPage({ id: 'p1', imageData });
      const note = createNote([page]);
      const generator = new ExcalidrawGenerator();
      const doc = generator.generate(note);

      const fileEntry = doc.files['p1'] as ExcalidrawFileEntry;
      const base64Part = fileEntry.dataURL.replace('data:image/png;base64,', '');
      const decoded = Uint8Array.from(atob(base64Part), c => c.charCodeAt(0));

      expect(decoded).toEqual(imageData);
    });

    it('다중 페이지 시 files에 모든 페이지 엔트리 생성', () => {
      const pages = [
        createPage({ id: 'p0', order: 0 }),
        createPage({ id: 'p1', order: 1 }),
      ];
      const note = createNote(pages);
      const generator = new ExcalidrawGenerator();
      const doc = generator.generate(note);

      expect(Object.keys(doc.files)).toHaveLength(2);
      expect(doc.files['p0']).toBeDefined();
      expect(doc.files['p1']).toBeDefined();
    });

    it('element의 fileId와 files 객체의 키가 일치', () => {
      const page = createPage({ id: 'test-id' });
      const note = createNote([page]);
      const generator = new ExcalidrawGenerator();
      const doc = generator.generate(note);

      const element = doc.elements[0];
      expect(doc.files[element.fileId]).toBeDefined();
    });
  });
});
