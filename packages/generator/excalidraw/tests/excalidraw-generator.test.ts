import { describe, expect, it } from 'vitest';
import type { ExcalidrawFileEntry } from '../src/excalidraw-generator.js';
import { ExcalidrawGenerator } from '../src/excalidraw-generator.js';
import { createNote, createPage } from './helpers.js';

const SHA1_HEX_RE = /^[0-9a-f]{40}$/;

describe('ExcalidrawGenerator', () => {
  describe('generate', () => {
    it('generates full document metadata', async () => {
      const note = createNote([createPage()]);
      const generator = new ExcalidrawGenerator();
      const doc = await generator.generate(note);

      expect(doc.type).toBe('excalidraw');
      expect(doc.version).toBe(2);
      expect(doc.source).toBe('petrify-converter');
      expect(doc.appState).toBeDefined();
    });

    it('creates one image element for a single page', async () => {
      const page = createPage({ id: 'p1', order: 0 });
      const note = createNote([page]);
      const generator = new ExcalidrawGenerator();
      const doc = await generator.generate(note);

      expect(doc.elements).toHaveLength(1);

      const el = doc.elements[0];
      expect(el.type).toBe('image');
      expect(el.fileId).toMatch(SHA1_HEX_RE);
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

    it('lays out multiple pages vertically with correct y coordinates', async () => {
      const pages = [
        createPage({ id: 'p0', order: 0, height: 1920 }),
        createPage({ id: 'p1', order: 1, height: 1920 }),
        createPage({ id: 'p2', order: 2, height: 1920 }),
      ];
      const note = createNote(pages);
      const generator = new ExcalidrawGenerator();
      const doc = await generator.generate(note);

      expect(doc.elements).toHaveLength(3);

      const gap = ExcalidrawGenerator.PAGE_GAP;
      expect(doc.elements[0].y).toBe(0);
      expect(doc.elements[1].y).toBe(1920 + gap);
      expect(doc.elements[2].y).toBe(2 * (1920 + gap));
    });

    it('places pages sorted by order', async () => {
      const img0 = new Uint8Array([0]);
      const img1 = new Uint8Array([1]);
      const img2 = new Uint8Array([2]);
      const pages = [
        createPage({ id: 'p2', order: 2, imageData: img2 }),
        createPage({ id: 'p0', order: 0, imageData: img0 }),
        createPage({ id: 'p1', order: 1, imageData: img1 }),
      ];
      const note = createNote(pages);
      const generator = new ExcalidrawGenerator();
      const doc = await generator.generate(note);

      expect(doc.elements[0].id).toBe('element-p0');
      expect(doc.elements[1].id).toBe('element-p1');
      expect(doc.elements[2].id).toBe('element-p2');
    });

    it('returns empty elements and files when pages array is empty', async () => {
      const note = createNote([]);
      const generator = new ExcalidrawGenerator();
      const doc = await generator.generate(note);

      expect(doc.elements).toHaveLength(0);
      expect(Object.keys(doc.files)).toHaveLength(0);
    });
  });

  describe('files object', () => {
    it('includes base64-encoded dataURL in files object', async () => {
      const imageData = new Uint8Array([0x89, 0x50, 0x4e, 0x47]);
      const page = createPage({ id: 'file-1', imageData });
      const note = createNote([page]);
      const generator = new ExcalidrawGenerator();
      const doc = await generator.generate(note);

      const fileId = doc.elements[0].fileId;
      const fileEntry = doc.files[fileId] as ExcalidrawFileEntry;
      expect(fileEntry).toBeDefined();
      expect(fileEntry.mimeType).toBe('image/png');
      expect(fileEntry.id).toMatch(SHA1_HEX_RE);
      expect(fileEntry.dataURL).toMatch(/^data:image\/png;base64,.+/);
      expect(typeof fileEntry.created).toBe('number');
    });

    it('restores original imageData when decoding base64 from dataURL', async () => {
      const imageData = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
      const page = createPage({ id: 'p1', imageData });
      const note = createNote([page]);
      const generator = new ExcalidrawGenerator();
      const doc = await generator.generate(note);

      const fileId = doc.elements[0].fileId;
      const fileEntry = doc.files[fileId] as ExcalidrawFileEntry;
      const base64Part = fileEntry.dataURL.replace('data:image/png;base64,', '');
      const decoded = Uint8Array.from(atob(base64Part), (c) => c.charCodeAt(0));

      expect(decoded).toEqual(imageData);
    });

    it('creates file entries for all pages when there are multiple pages', async () => {
      const pages = [
        createPage({ id: 'p0', order: 0, imageData: new Uint8Array([0]) }),
        createPage({ id: 'p1', order: 1, imageData: new Uint8Array([1]) }),
      ];
      const note = createNote(pages);
      const generator = new ExcalidrawGenerator();
      const doc = await generator.generate(note);

      expect(Object.keys(doc.files)).toHaveLength(2);
      expect(doc.files[doc.elements[0].fileId]).toBeDefined();
      expect(doc.files[doc.elements[1].fileId]).toBeDefined();
    });

    it('matches element fileId with files object key', async () => {
      const page = createPage({ id: 'test-id' });
      const note = createNote([page]);
      const generator = new ExcalidrawGenerator();
      const doc = await generator.generate(note);

      const element = doc.elements[0];
      expect(doc.files[element.fileId]).toBeDefined();
    });
  });
});
