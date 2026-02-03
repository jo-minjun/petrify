import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GutenyeOcr } from '../src/gutenye-ocr.js';
import type { OcrPort } from '@petrify/core';

// @gutenye/ocr-browser 모킹
vi.mock('@gutenye/ocr-browser', () => ({
  default: {
    create: vi.fn(() =>
      Promise.resolve({
        detect: vi.fn(() =>
          Promise.resolve([
            {
              text: '안녕하세요',
              score: 0.95,
              mean: 0.95,
              box: [[0, 0], [100, 0], [100, 30], [0, 30]],
            },
            {
              text: '테스트',
              score: 0.4,
              mean: 0.4,
              box: [[0, 50], [80, 50], [80, 80], [0, 80]],
            },
          ])
        ),
      })
    ),
  },
}));

describe('GutenyeOcr', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('OcrPort 인터페이스 구현', async () => {
    const ocr: OcrPort = await GutenyeOcr.create();
    expect(ocr.recognize).toBeDefined();
  });

  it('이미지에서 텍스트 추출', async () => {
    const ocr = await GutenyeOcr.create();
    const image = new ArrayBuffer(100);

    const result = await ocr.recognize(image);

    expect(result.regions.length).toBe(2);
    expect(result.regions[0].text).toBe('안녕하세요');
    expect(result.regions[0].confidence).toBe(0.95);
  });

  it('confidence 임계값 적용', async () => {
    const ocr = await GutenyeOcr.create();
    const image = new ArrayBuffer(100);

    const result = await ocr.recognize(image, { confidenceThreshold: 0.5 });

    expect(result.regions.length).toBe(1);
    expect(result.regions[0].text).toBe('안녕하세요');
  });

  it('전체 텍스트 결합', async () => {
    const ocr = await GutenyeOcr.create();
    const image = new ArrayBuffer(100);

    const result = await ocr.recognize(image);

    expect(result.text).toBe('안녕하세요\n테스트');
  });
});
