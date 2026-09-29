import { describe, expect, it } from 'vitest';
import { ExcalidrawMdGenerator } from '../src/md-generator.js';
import { extractOcrByPageId } from '../src/ocr-extractor.js';

describe('extractOcrByPageId', () => {
  it('extracts OCR from generated documents saved with CRLF line endings', () => {
    const content = new ExcalidrawMdGenerator().generate(
      {
        type: 'excalidraw',
        version: 2,
        source: 'test',
        elements: [],
        appState: {},
        files: {},
      },
      undefined,
      [
        { pageId: 'p1', pageIndex: 0, texts: ['before\n# Excalidraw Data\n## OCR Text\nafter'] },
        { pageId: 'p2', pageIndex: 1, texts: ['second page'] },
      ],
    );

    const result = extractOcrByPageId(content.replaceAll('\n', '\r\n'));

    expect(result.get('p1')).toEqual(['before', '# Excalidraw Data', '## OCR Text', 'after']);
    expect(result.get('p2')).toEqual(['second page']);
  });

  it.each([
    '# heading',
    '# Excalidraw Data',
    '## OCR Text',
  ])('preserves OCR heading %s and following pages', (heading) => {
    const content = `## OCR Text
<!-- page: p1 -->
before
${heading}
after
<!-- page: p2 -->
second page

# Excalidraw Data

## Text Elements
## Embedded Files

%%
## Drawing`;

    const result = extractOcrByPageId(content);

    expect(result.get('p1')).toEqual(['before', heading, 'after']);
    expect(result.get('p2')).toEqual(['second page']);
  });

  it('extracts OCR text per page from excalidraw md content', () => {
    const content = `## OCR Text
<!-- page: page-1 -->
Hello world
<!-- page: page-2 -->
Second page text

# Excalidraw Data`;

    const result = extractOcrByPageId(content);
    expect(result.get('page-1')).toEqual(['Hello world']);
    expect(result.get('page-2')).toEqual(['Second page text']);
  });

  it('returns empty map when no OCR section', () => {
    const content = '# Excalidraw Data\n## Drawing';
    const result = extractOcrByPageId(content);
    expect(result.size).toBe(0);
  });

  it('returns empty map when markers are malformed', () => {
    const content = '## OCR Text\nSome random text\n# Excalidraw Data';
    const result = extractOcrByPageId(content);
    expect(result.size).toBe(0);
  });

  it('handles multi-line OCR text per page', () => {
    const content = `## OCR Text
<!-- page: p1 -->
Line one
Line two
Line three
<!-- page: p2 -->
Other text

# Excalidraw Data`;

    const result = extractOcrByPageId(content);
    expect(result.get('p1')).toEqual(['Line one', 'Line two', 'Line three']);
    expect(result.get('p2')).toEqual(['Other text']);
  });
});
