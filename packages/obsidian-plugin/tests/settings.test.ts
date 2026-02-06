import { describe, it, expect } from 'vitest';
import { DEFAULT_SETTINGS, LANGUAGE_HINT_OPTIONS } from '../src/settings.js';

describe('PetrifySettings', () => {
  it('DEFAULT_SETTINGS는 빈 watchMappings를 가진다', () => {
    expect(DEFAULT_SETTINGS.watchMappings).toEqual([]);
  });

  it('DEFAULT_SETTINGS는 기본 OCR 설정을 가진다', () => {
    expect(DEFAULT_SETTINGS.ocr.confidenceThreshold).toBe(50);
  });

  it('DEFAULT_SETTINGS는 deleteConvertedOnSourceDelete가 false이다', () => {
    expect(DEFAULT_SETTINGS.deleteConvertedOnSourceDelete).toBe(false);
  });
});

describe('OcrProvider', () => {
  it('기본 provider는 tesseract', () => {
    expect(DEFAULT_SETTINGS.ocr.provider).toBe('tesseract');
  });
});

describe('LanguageHint', () => {
  it('5개 언어 옵션 제공', () => {
    expect(LANGUAGE_HINT_OPTIONS).toHaveLength(5);
  });

  it('기본 languageHints는 ko, en', () => {
    expect(DEFAULT_SETTINGS.ocr.googleVision.languageHints).toEqual(['ko', 'en']);
  });
});

describe('googleVision', () => {
  it('기본 apiKey는 빈 문자열', () => {
    expect(DEFAULT_SETTINGS.ocr.googleVision.apiKey).toBe('');
  });
});
