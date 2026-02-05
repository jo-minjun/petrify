import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GoogleVisionOcr } from '../src/google-vision-ocr.js';
import type { OcrPort } from '@petrify/core';

const MOCK_VISION_RESPONSE = {
  responses: [{
    fullTextAnnotation: {
      text: '안녕하세요\n테스트입니다\n',
      pages: [{
        confidence: 0.95,
        blocks: [
          {
            confidence: 0.97,
            boundingBox: {
              vertices: [
                { x: 10, y: 20 },
                { x: 200, y: 20 },
                { x: 200, y: 60 },
                { x: 10, y: 60 },
              ],
            },
            paragraphs: [{
              words: [
                { symbols: [{ text: '안' }, { text: '녕' }, { text: '하' }, { text: '세' }, { text: '요' }] },
              ],
            }],
          },
          {
            confidence: 0.93,
            boundingBox: {
              vertices: [
                { x: 10, y: 80 },
                { x: 300, y: 80 },
                { x: 300, y: 120 },
                { x: 10, y: 120 },
              ],
            },
            paragraphs: [{
              words: [
                { symbols: [{ text: '테' }, { text: '스' }, { text: '트' }, { text: '입' }, { text: '니' }, { text: '다' }] },
              ],
            }],
          },
        ],
      }],
    },
  }],
};

function mockFetchSuccess(body: unknown) {
  return vi.spyOn(globalThis, 'fetch').mockResolvedValue(
    new Response(JSON.stringify(body), { status: 200 })
  );
}

describe('GoogleVisionOcr', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('OcrPort 인터페이스를 구현한다', () => {
    const ocr: OcrPort = new GoogleVisionOcr({ apiKey: 'test-key' });
    expect(ocr.recognize).toBeDefined();
  });

  it('Vision API 응답을 OcrResult로 올바르게 매핑한다', async () => {
    mockFetchSuccess(MOCK_VISION_RESPONSE);
    const ocr = new GoogleVisionOcr({ apiKey: 'test-key' });

    const result = await ocr.recognize(new ArrayBuffer(100));

    expect(result.text).toBe('안녕하세요\n테스트입니다');
    expect(result.confidence).toBe(95);
    expect(result.regions).toHaveLength(2);
  });

  it('block별 bounding box 좌표를 변환한다', async () => {
    mockFetchSuccess(MOCK_VISION_RESPONSE);
    const ocr = new GoogleVisionOcr({ apiKey: 'test-key' });

    const result = await ocr.recognize(new ArrayBuffer(100));

    expect(result.regions[0]).toEqual({
      text: '안녕하세요',
      confidence: 97,
      x: 10,
      y: 20,
      width: 190,
      height: 40,
    });
    expect(result.regions[1]).toEqual({
      text: '테스트입니다',
      confidence: 93,
      x: 10,
      y: 80,
      width: 290,
      height: 40,
    });
  });
});
