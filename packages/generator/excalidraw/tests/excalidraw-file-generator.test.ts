import { sha1Hex } from '@petrify/core';
import { describe, expect, it } from 'vitest';
import { ExcalidrawFileGenerator } from '../src/excalidraw-file-generator.js';
import { createNote, createPage } from './helpers.js';

const SHA1_HEX_RE = /^[0-9a-f]{40}$/;

describe('ExcalidrawFileGenerator', () => {
  it('includes page images in assets with SHA-1 hash filenames', async () => {
    const generator = new ExcalidrawFileGenerator();
    const imageData = new Uint8Array([0x89, 0x50, 0x4e, 0x47]);
    const note = createNote([createPage({ id: 'p1', imageData })]);
    const output = await generator.generate(note, 'test-note');

    expect(output.assets.size).toBe(1);
    const hash = await sha1Hex(imageData);
    expect(output.assets.get(`${hash}.png`)).toEqual(imageData);
  });

  it('includes SHA-1 hash based embedded files references in content', async () => {
    const generator = new ExcalidrawFileGenerator();
    const imageData = new Uint8Array([0x89, 0x50, 0x4e, 0x47]);
    const note = createNote([createPage({ id: 'p1', imageData })]);
    const output = await generator.generate(note, 'test-note');

    const hash = await sha1Hex(imageData);
    expect(output.content).toContain(`${hash}: [[assets/test-note/${hash}.png]]`);
  });

  it('includes all assets for multiple pages', async () => {
    const generator = new ExcalidrawFileGenerator();
    const img1 = new Uint8Array([1]);
    const img2 = new Uint8Array([2]);
    const note = createNote([
      createPage({ id: 'p1', order: 0, imageData: img1 }),
      createPage({ id: 'p2', order: 1, imageData: img2 }),
    ]);
    const output = await generator.generate(note, 'my-note');

    expect(output.assets.size).toBe(2);

    const hash1 = await sha1Hex(img1);
    const hash2 = await sha1Hex(img2);
    expect(output.assets.has(`${hash1}.png`)).toBe(true);
    expect(output.assets.has(`${hash2}.png`)).toBe(true);
    expect(output.content).toContain(`${hash1}: [[assets/my-note/${hash1}.png]]`);
    expect(output.content).toContain(`${hash2}: [[assets/my-note/${hash2}.png]]`);
  });

  it('includes OCR results in content', async () => {
    const generator = new ExcalidrawFileGenerator();
    const note = createNote([createPage()]);
    const ocrResults = [{ pageIndex: 0, texts: ['안녕하세요', '테스트'] }];
    const output = await generator.generate(note, 'test', ocrResults);

    expect(output.content).toContain('## OCR Text');
    expect(output.content).toContain('안녕하세요');
    expect(output.content).toContain('테스트');
  });

  it('does not contain base64 dataURL in content (external asset approach)', async () => {
    const generator = new ExcalidrawFileGenerator();
    const note = createNote([createPage()]);
    const output = await generator.generate(note, 'test');

    expect(output.content).not.toContain('data:image/png;base64,');
  });

  it('uses Excalidraw plugin compatible fileId format (alphanumeric only) for embedded files', async () => {
    const generator = new ExcalidrawFileGenerator();
    const note = createNote([createPage()]);
    const output = await generator.generate(note, 'test');

    const embeddedSection = output.content.match(/## Embedded Files\n([\s\S]*?)\n%%/)?.[1] ?? '';
    const fileIds = [...embeddedSection.matchAll(/^(\S+):/gm)].map((m) => m[1]);
    for (const fileId of fileIds) {
      expect(fileId).toMatch(SHA1_HEX_RE);
    }
  });
});
