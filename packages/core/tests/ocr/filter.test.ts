import { describe, expect, it } from 'vitest';
import { filterOcrByConfidence } from '../../src/ocr/filter.js';
import type { OcrRegion } from '../../src/ports/ocr.js';

describe('filterOcrByConfidence', () => {
  it('returns only regions at or above the confidence threshold', () => {
    const regions: OcrRegion[] = [
      { text: '높음', x: 0, y: 0, width: 10, height: 10, confidence: 80 },
      { text: '낮음', x: 0, y: 0, width: 10, height: 10, confidence: 30 },
      { text: '경계', x: 0, y: 0, width: 10, height: 10, confidence: 50 },
    ];

    const result = filterOcrByConfidence(regions, 50);

    expect(result).toEqual(['높음', '경계']);
  });

  it('includes regions without confidence (treated as 100)', () => {
    const regions: OcrRegion[] = [
      { text: '없음', x: 0, y: 0, width: 10, height: 10 },
      { text: '낮음', x: 0, y: 0, width: 10, height: 10, confidence: 30 },
    ];

    const result = filterOcrByConfidence(regions, 50);

    expect(result).toEqual(['없음']);
  });

  it('returns an empty array when given an empty array', () => {
    const result = filterOcrByConfidence([], 50);
    expect(result).toEqual([]);
  });

  it('excludes empty strings and whitespace-only text', () => {
    const regions: OcrRegion[] = [
      { text: '유효', x: 0, y: 0, width: 10, height: 10, confidence: 80 },
      { text: '', x: 0, y: 0, width: 10, height: 10, confidence: 80 },
      { text: '   ', x: 0, y: 0, width: 10, height: 10, confidence: 80 },
      { text: '\n\t', x: 0, y: 0, width: 10, height: 10, confidence: 80 },
    ];

    const result = filterOcrByConfidence(regions, 50);

    expect(result).toEqual(['유효']);
  });
});
