import { describe, expect, it } from 'vitest';
import type { Note, OcrTextResult, Page } from '../src/models/index.js';
import { mergeOcrResults } from '../src/ocr/merge.js';

function createPage(id: string, order: number): Page {
  return { id, order, imageData: new Uint8Array([order]), width: 100, height: 100 };
}

function createNote(pages: Page[]): Note {
  return { title: 'test', pages, createdAt: new Date(), modifiedAt: new Date() };
}

describe('mergeOcrResults', () => {
  it('uses updated OCR when available', () => {
    const page = createPage('p1', 0);
    const note = createNote([page]);
    const existingOcr = new Map([['p1', ['old text']]]);
    const newOcr: OcrTextResult = { pageId: 'p1', pageIndex: 0, texts: ['new text'] };
    const updates = new Map([['p1', { ocrResult: newOcr }]]);

    const result = mergeOcrResults(note, existingOcr, updates, []);

    expect(result).toHaveLength(1);
    expect(result[0].texts).toEqual(['new text']);
  });

  it('falls back to existing OCR for unchanged pages', () => {
    const page = createPage('p1', 0);
    const note = createNote([page]);
    const existingOcr = new Map([['p1', ['existing text']]]);

    const result = mergeOcrResults(note, existingOcr, new Map(), []);

    expect(result).toHaveLength(1);
    expect(result[0].pageId).toBe('p1');
    expect(result[0].pageIndex).toBe(0);
    expect(result[0].texts).toEqual(['existing text']);
  });

  it('skips removed pages', () => {
    const pages = [createPage('p1', 0), createPage('p2', 1)];
    const note = createNote(pages);
    const existingOcr = new Map([
      ['p1', ['text 1']],
      ['p2', ['text 2']],
    ]);

    const result = mergeOcrResults(note, existingOcr, new Map(), ['p2']);

    expect(result).toHaveLength(1);
    expect(result[0].pageId).toBe('p1');
  });

  it('skips pages with no OCR data', () => {
    const page = createPage('p1', 0);
    const note = createNote([page]);

    const result = mergeOcrResults(note, new Map(), new Map(), []);

    expect(result).toHaveLength(0);
  });

  it('sorts pages by order', () => {
    const pages = [createPage('p2', 1), createPage('p1', 0)];
    const note = createNote(pages);
    const existingOcr = new Map([
      ['p1', ['first']],
      ['p2', ['second']],
    ]);

    const result = mergeOcrResults(note, existingOcr, new Map(), []);

    expect(result[0].pageId).toBe('p1');
    expect(result[1].pageId).toBe('p2');
  });
});
