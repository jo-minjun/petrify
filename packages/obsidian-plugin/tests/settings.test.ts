import { describe, it, expect } from 'vitest';
import { DEFAULT_SETTINGS } from '../src/settings.js';

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
