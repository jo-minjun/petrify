import type { OcrPort } from '@petrify/core';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GoogleVisionOcr } from '../src/google-vision-ocr.js';

const MOCK_VISION_RESPONSE = {
  responses: [
    {
      fullTextAnnotation: {
        text: '안녕하세요\n테스트입니다\n',
        pages: [
          {
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
                paragraphs: [
                  {
                    words: [
                      {
                        symbols: [
                          { text: '안' },
                          { text: '녕' },
                          { text: '하' },
                          { text: '세' },
                          { text: '요' },
                        ],
                      },
                    ],
                  },
                ],
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
                paragraphs: [
                  {
                    words: [
                      {
                        symbols: [
                          { text: '테' },
                          { text: '스' },
                          { text: '트' },
                          { text: '입' },
                          { text: '니' },
                          { text: '다' },
                        ],
                      },
                    ],
                  },
                ],
              },
            ],
          },
        ],
      },
    },
  ],
};

function mockFetchSuccess(body: unknown) {
  return vi
    .spyOn(globalThis, 'fetch')
    .mockResolvedValue(new Response(JSON.stringify(body), { status: 200 }));
}

describe('GoogleVisionOcr', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('implements the OcrPort interface', () => {
    const ocr: OcrPort = new GoogleVisionOcr({ apiKey: 'test-key' });
    expect(ocr.recognize).toBeDefined();
  });

  it('correctly maps Vision API response to OcrResult', async () => {
    mockFetchSuccess(MOCK_VISION_RESPONSE);
    const ocr = new GoogleVisionOcr({ apiKey: 'test-key' });

    const result = await ocr.recognize(new ArrayBuffer(100));

    expect(result.text).toBe('안녕하세요\n테스트입니다');
    expect(result.confidence).toBe(95);
    expect(result.regions).toHaveLength(2);
  });

  it('converts bounding box coordinates per block', async () => {
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

  it('passes API key as query parameter', async () => {
    const spy = mockFetchSuccess(MOCK_VISION_RESPONSE);
    const ocr = new GoogleVisionOcr({ apiKey: 'my-api-key' });

    await ocr.recognize(new ArrayBuffer(100));

    expect(spy).toHaveBeenCalledWith(
      'https://vision.googleapis.com/v1/images:annotate?key=my-api-key',
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('passes languageHints to imageContext', async () => {
    const spy = mockFetchSuccess(MOCK_VISION_RESPONSE);
    const ocr = new GoogleVisionOcr({ apiKey: 'test-key', languageHints: ['ko', 'en'] });

    await ocr.recognize(new ArrayBuffer(100));

    const body = JSON.parse(spy.mock.calls[0][1]?.body as string);
    expect(body.requests[0].imageContext).toEqual({ languageHints: ['ko', 'en'] });
  });

  it('OcrOptions.language overrides config.languageHints', async () => {
    const spy = mockFetchSuccess(MOCK_VISION_RESPONSE);
    const ocr = new GoogleVisionOcr({ apiKey: 'test-key', languageHints: ['ko', 'en'] });

    await ocr.recognize(new ArrayBuffer(100), { language: 'ja' });

    const body = JSON.parse(spy.mock.calls[0][1]?.body as string);
    expect(body.requests[0].imageContext).toEqual({ languageHints: ['ja'] });
  });

  it('does not include imageContext when languageHints is not specified', async () => {
    const spy = mockFetchSuccess(MOCK_VISION_RESPONSE);
    const ocr = new GoogleVisionOcr({ apiKey: 'test-key' });

    await ocr.recognize(new ArrayBuffer(100));

    const body = JSON.parse(spy.mock.calls[0][1]?.body as string);
    expect(body.requests[0].imageContext).toBeUndefined();
  });

  it('filters out regions below confidenceThreshold', async () => {
    mockFetchSuccess(MOCK_VISION_RESPONSE);
    const ocr = new GoogleVisionOcr({ apiKey: 'test-key' });

    // Second block confidence in MOCK_VISION_RESPONSE is 0.93 -> 93
    const result = await ocr.recognize(new ArrayBuffer(100), { confidenceThreshold: 95 });

    expect(result.regions).toHaveLength(1);
    expect(result.regions[0].text).toBe('안녕하세요');
    expect(result.text).toBe('안녕하세요');
  });

  it('returns empty result for image with no text', async () => {
    mockFetchSuccess({ responses: [{}] });
    const ocr = new GoogleVisionOcr({ apiKey: 'test-key' });

    const result = await ocr.recognize(new ArrayBuffer(100));

    expect(result.text).toBe('');
    expect(result.regions).toHaveLength(0);
    expect(result.confidence).toBeUndefined();
  });

  it('throws OcrInitializationError on API authentication failure (403)', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('Forbidden', { status: 403 }));
    const ocr = new GoogleVisionOcr({ apiKey: 'invalid-key' });

    await expect(ocr.recognize(new ArrayBuffer(100))).rejects.toThrow(
      'Vision API authentication failed (403)',
    );
  });

  it('throws OcrRecognitionError on API error response (500)', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response('Internal Server Error', { status: 500 }),
    );
    const ocr = new GoogleVisionOcr({ apiKey: 'test-key' });

    await expect(ocr.recognize(new ArrayBuffer(100))).rejects.toThrow('Vision API error (500)');
  });

  it('throws OcrRecognitionError on network failure', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('Network error'));
    const ocr = new GoogleVisionOcr({ apiKey: 'test-key' });

    await expect(ocr.recognize(new ArrayBuffer(100))).rejects.toThrow(
      'Vision API request failed: Network error',
    );
  });

  it('throws OcrRecognitionError when response body contains error field', async () => {
    mockFetchSuccess({
      responses: [{ error: { message: 'Bad image', code: 400 } }],
    });
    const ocr = new GoogleVisionOcr({ apiKey: 'test-key' });

    await expect(ocr.recognize(new ArrayBuffer(100))).rejects.toThrow(
      'Vision API error: Bad image',
    );
  });
});
