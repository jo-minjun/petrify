import { describe, expect, it } from 'vitest';
import { FrontmatterMetadataAdapter } from '../src/frontmatter-metadata-adapter.js';

describe('FrontmatterMetadataAdapter', () => {
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
