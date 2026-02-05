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

  it('API 키를 쿼리 파라미터로 전달한다', async () => {
    const spy = mockFetchSuccess(MOCK_VISION_RESPONSE);
    const ocr = new GoogleVisionOcr({ apiKey: 'my-api-key' });

    await ocr.recognize(new ArrayBuffer(100));

    expect(spy).toHaveBeenCalledWith(
      'https://vision.googleapis.com/v1/images:annotate?key=my-api-key',
      expect.objectContaining({ method: 'POST' })
    );
  });

  it('languageHints를 imageContext에 전달한다', async () => {
    const spy = mockFetchSuccess(MOCK_VISION_RESPONSE);
    const ocr = new GoogleVisionOcr({ apiKey: 'test-key', languageHints: ['ko', 'en'] });

    await ocr.recognize(new ArrayBuffer(100));

    const body = JSON.parse(spy.mock.calls[0][1]!.body as string);
    expect(body.requests[0].imageContext).toEqual({ languageHints: ['ko', 'en'] });
  });

  it('OcrOptions.language가 config.languageHints를 오버라이드한다', async () => {
    const spy = mockFetchSuccess(MOCK_VISION_RESPONSE);
    const ocr = new GoogleVisionOcr({ apiKey: 'test-key', languageHints: ['ko', 'en'] });

    await ocr.recognize(new ArrayBuffer(100), { language: 'ja' });

    const body = JSON.parse(spy.mock.calls[0][1]!.body as string);
    expect(body.requests[0].imageContext).toEqual({ languageHints: ['ja'] });
  });

  it('languageHints 미지정 시 imageContext를 포함하지 않는다', async () => {
    const spy = mockFetchSuccess(MOCK_VISION_RESPONSE);
    const ocr = new GoogleVisionOcr({ apiKey: 'test-key' });

    await ocr.recognize(new ArrayBuffer(100));

    const body = JSON.parse(spy.mock.calls[0][1]!.body as string);
    expect(body.requests[0].imageContext).toBeUndefined();
  });

  it('confidenceThreshold 이하 region을 필터링한다', async () => {
    mockFetchSuccess(MOCK_VISION_RESPONSE);
    const ocr = new GoogleVisionOcr({ apiKey: 'test-key' });

    // MOCK_VISION_RESPONSE의 두 번째 block confidence는 0.93 → 93
    const result = await ocr.recognize(new ArrayBuffer(100), { confidenceThreshold: 95 });

    expect(result.regions).toHaveLength(1);
    expect(result.regions[0].text).toBe('안녕하세요');
    expect(result.text).toBe('안녕하세요');
  });

  it('텍스트 없는 이미지 → 빈 결과 반환', async () => {
    mockFetchSuccess({ responses: [{}] });
    const ocr = new GoogleVisionOcr({ apiKey: 'test-key' });

    const result = await ocr.recognize(new ArrayBuffer(100));

    expect(result.text).toBe('');
    expect(result.regions).toHaveLength(0);
    expect(result.confidence).toBeUndefined();
  });

  it('API 인증 실패(403) → OcrInitializationError', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response('Forbidden', { status: 403 })
    );
    const ocr = new GoogleVisionOcr({ apiKey: 'invalid-key' });

    await expect(ocr.recognize(new ArrayBuffer(100)))
      .rejects.toThrow('Vision API 인증 실패 (403)');
  });

  it('API 에러 응답(500) → OcrRecognitionError', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response('Internal Server Error', { status: 500 })
    );
    const ocr = new GoogleVisionOcr({ apiKey: 'test-key' });

    await expect(ocr.recognize(new ArrayBuffer(100)))
      .rejects.toThrow('Vision API 에러 (500)');
  });

  it('네트워크 실패 → OcrRecognitionError', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('Network error'));
    const ocr = new GoogleVisionOcr({ apiKey: 'test-key' });

    await expect(ocr.recognize(new ArrayBuffer(100)))
      .rejects.toThrow('Vision API 요청 실패: Network error');
  });

  it('응답 body에 error 필드 → OcrRecognitionError', async () => {
    mockFetchSuccess({
      responses: [{ error: { message: 'Bad image', code: 400 } }],
    });
    const ocr = new GoogleVisionOcr({ apiKey: 'test-key' });

    await expect(ocr.recognize(new ArrayBuffer(100)))
      .rejects.toThrow('Vision API 에러: Bad image');
  });
});
