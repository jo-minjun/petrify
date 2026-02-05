import { describe, it, expect } from 'vitest';
import { ExcalidrawGenerator } from '../../src/excalidraw';
import type { Note, Page } from '../../src/models';

describe('ExcalidrawGenerator', () => {
  describe('generate', () => {
    it('전체 문서 생성', () => {
      const page: Page = {
        id: 'page-1',
        imageData: new Uint8Array([0x89, 0x50, 0x4e, 0x47]),
        order: 0,
        width: 1440,
        height: 1920,
      };
      const note: Note = {
        title: 'Test',
        pages: [page],
        createdAt: new Date(),
        modifiedAt: new Date(),
      };
      const generator = new ExcalidrawGenerator();
      const doc = generator.generate(note);

      expect(doc.type).toBe('excalidraw');
      expect(doc.version).toBe(2);
      expect(doc.source).toBe('petrify-converter');
      expect(doc.appState).toBeDefined();
    });
  });
});
