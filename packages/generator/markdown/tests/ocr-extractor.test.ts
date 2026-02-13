import { describe, expect, it } from 'vitest';
import { extractOcrByPageId } from '../src/ocr-extractor.js';

describe('extractOcrByPageId', () => {
  it('extracts OCR text per page from markdown content', () => {
    const content = `![[assets/test/page-1.png]]
![[assets/test/page-2.png]]

---

<!-- page: page-1 -->
Hello world

<!-- page: page-2 -->
Second page text
`;

    const result = extractOcrByPageId(content);
    expect(result.get('page-1')).toEqual(['Hello world']);
    expect(result.get('page-2')).toEqual(['Second page text']);
  });

  it('returns empty map when no separator', () => {
    const content = '![[assets/test/page-1.png]]';
    const result = extractOcrByPageId(content);
    expect(result.size).toBe(0);
  });

  it('returns empty map when no markers after separator', () => {
    const content = '![[assets/test/page-1.png]]\n\n---\n\nSome random text';
    const result = extractOcrByPageId(content);
    expect(result.size).toBe(0);
  });

  it('handles multi-line OCR text per page', () => {
    const content = `![[assets/test/p1.png]]

---

<!-- page: p1 -->
Line one
Line two
Line three
<!-- page: p2 -->
Other text
`;

    const result = extractOcrByPageId(content);
    expect(result.get('p1')).toEqual(['Line one', 'Line two', 'Line three']);
    expect(result.get('p2')).toEqual(['Other text']);
  });
});
