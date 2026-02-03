import { describe, it, expect } from 'vitest';
import { filterOcrByConfidence } from '../../src/ocr/filter.js';
import type { OcrRegion } from '../../src/ports/ocr.js';

describe('filterOcrByConfidence', () => {
  it('임계값 이상인 region만 반환', () => {
    const regions: OcrRegion[] = [
      { text: '높음', x: 0, y: 0, width: 10, height: 10, confidence: 80 },
      { text: '낮음', x: 0, y: 0, width: 10, height: 10, confidence: 30 },
      { text: '경계', x: 0, y: 0, width: 10, height: 10, confidence: 50 },
    ];

    const result = filterOcrByConfidence(regions, 50);

    expect(result).toEqual(['높음', '경계']);
  });

  it('confidence가 없으면 포함 (100으로 간주)', () => {
    const regions: OcrRegion[] = [
      { text: '없음', x: 0, y: 0, width: 10, height: 10 },
      { text: '낮음', x: 0, y: 0, width: 10, height: 10, confidence: 30 },
    ];

    const result = filterOcrByConfidence(regions, 50);

    expect(result).toEqual(['없음']);
  });

  it('빈 배열이면 빈 배열 반환', () => {
    const result = filterOcrByConfidence([], 50);
    expect(result).toEqual([]);
  });
});
