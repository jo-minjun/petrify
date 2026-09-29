import { describe, expect, it } from 'vitest';
import { FrontmatterMetadataAdapter } from '../src/frontmatter-metadata-adapter.js';
import { updateKeepInContent } from '../src/utils/frontmatter.js';

describe('FrontmatterMetadataAdapter', () => {
  it('preserves source folder ownership through saving, loading and keep toggles', async () => {
    let content = '';
    const adapter = new FrontmatterMetadataAdapter(() => Promise.resolve(content));
    content = adapter.formatMetadata({
      source: 'gdrive://file123',
      sourceFolder: 'gdrive://folder123',
      parser: 'pdf',
      fileHash: 'abc',
      pageHashes: null,
      keep: false,
    });
    content = updateKeepInContent(content, true);
    expect(await adapter.getMetadata('out/test.md')).toMatchObject({
      source: 'gdrive://file123',
      sourceFolder: 'gdrive://folder123',
      keep: true,
    });
  });
  it('loads generated content by output path for incremental OCR preservation', async () => {
    const files = new Map([
      ['out/note.md', '---\npetrify:\n  source: gdrive://abc\n  keep: true\n---\nOld OCR'],
    ]);
    const adapter = new FrontmatterMetadataAdapter(async (path) => {
      const content = files.get(path);
      if (content === undefined) throw new Error('ENOENT');
      return content;
    });

    expect(await adapter.getContent('out/note.md')).toContain('Old OCR');
    expect(await adapter.getMetadata('out/note.md')).toMatchObject({
      keep: true,
      source: 'gdrive://abc',
    });
    expect(await adapter.getContent('missing.md')).toBeUndefined();
  });
});
