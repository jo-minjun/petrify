import { describe, expect, it } from 'vitest';
import { extractOcrByPageId } from '../src/ocr-extractor.js';

describe('extractOcrByPageId', () => {
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
