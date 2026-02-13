import type { IncrementalInput, OcrTextResult } from '@petrify/core';
import { describe, expect, it } from 'vitest';
import { ExcalidrawFileGenerator } from '../src/excalidraw-file-generator.js';
import { createNote, createPage } from './helpers.js';

describe('ExcalidrawFileGenerator.incrementalUpdate', () => {
  it('regenerates output with OCR reuse for unchanged pages', async () => {
    const generator = new ExcalidrawFileGenerator();

    const page1 = createPage({ id: 'page-1', order: 0 });
    const page2 = createPage({
      id: 'page-2',
      order: 1,
      imageData: new Uint8Array([0x89, 0x50, 0x4e, 0x47, 1]),
    });
    const initialNote = createNote([page1, page2]);
    const initialOcr: OcrTextResult[] = [
      { pageId: 'page-1', pageIndex: 0, texts: ['Page 1 text'] },
      { pageId: 'page-2', pageIndex: 1, texts: ['Page 2 text'] },
    ];
    const initialOutput = await generator.generate(initialNote, 'test', initialOcr);

    const newPage2 = createPage({
      id: 'page-2',
      order: 1,
      imageData: new Uint8Array([1, 2, 3, 4, 5]),
    });
    const updatedNote = createNote([page1, newPage2]);
    const newOcr: OcrTextResult = {
      pageId: 'page-2',
      pageIndex: 1,
      texts: ['Updated page 2 text'],
    };

    const input: IncrementalInput = {
      existingContent: initialOutput.content,
      existingAssets: initialOutput.assets,
      updates: new Map([['page-2', { page: newPage2, ocrResult: newOcr }]]),
      removedPageIds: [],
    };

    const result = await generator.incrementalUpdate(input, updatedNote, 'test');

    expect(result.content).toContain('<!-- page: page-1 -->');
    expect(result.content).toContain('Page 1 text');
    expect(result.content).toContain('<!-- page: page-2 -->');
    expect(result.content).toContain('Updated page 2 text');
    expect(result.content).not.toContain('Page 2 text');
  });

  it('handles page addition', async () => {
    const generator = new ExcalidrawFileGenerator();

    const page1 = createPage({ id: 'page-1', order: 0 });
    const initialNote = createNote([page1]);
    const initialOcr: OcrTextResult[] = [
      { pageId: 'page-1', pageIndex: 0, texts: ['Page 1 text'] },
    ];
    const initialOutput = await generator.generate(initialNote, 'test', initialOcr);

    const page2 = createPage({
      id: 'page-2',
      order: 1,
      imageData: new Uint8Array([0x89, 0x50, 0x4e, 0x47, 1]),
    });
    const updatedNote = createNote([page1, page2]);
    const newOcr: OcrTextResult = {
      pageId: 'page-2',
      pageIndex: 1,
      texts: ['New page text'],
    };

    const input: IncrementalInput = {
      existingContent: initialOutput.content,
      existingAssets: initialOutput.assets,
      updates: new Map([['page-2', { page: page2, ocrResult: newOcr }]]),
      removedPageIds: [],
    };

    const result = await generator.incrementalUpdate(input, updatedNote, 'test');

    expect(result.content).toContain('Page 1 text');
    expect(result.content).toContain('New page text');
    expect(result.assets.size).toBe(2);
  });

  it('handles page removal', async () => {
    const generator = new ExcalidrawFileGenerator();

    const page1 = createPage({ id: 'page-1', order: 0 });
    const page2 = createPage({
      id: 'page-2',
      order: 1,
      imageData: new Uint8Array([0x89, 0x50, 0x4e, 0x47, 1]),
    });
    const initialNote = createNote([page1, page2]);
    const initialOcr: OcrTextResult[] = [
      { pageId: 'page-1', pageIndex: 0, texts: ['Page 1 text'] },
      { pageId: 'page-2', pageIndex: 1, texts: ['Page 2 text'] },
    ];
    const initialOutput = await generator.generate(initialNote, 'test', initialOcr);

    const updatedNote = createNote([page1]);

    const input: IncrementalInput = {
      existingContent: initialOutput.content,
      existingAssets: initialOutput.assets,
      updates: new Map(),
      removedPageIds: ['page-2'],
    };

    const result = await generator.incrementalUpdate(input, updatedNote, 'test');

    expect(result.content).toContain('Page 1 text');
    expect(result.content).not.toContain('Page 2 text');
    expect(result.assets.size).toBe(1);
  });
});
