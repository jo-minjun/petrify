import { describe, it, expect } from 'vitest';
import { ModelManager, ModelConfig } from '../src/model-manager.js';

describe('ModelManager', () => {
  it('모델 URL 설정', () => {
    const config: ModelConfig = {
      detectionUrl: 'https://example.com/det.onnx',
      recognitionUrl: 'https://example.com/rec.onnx',
      dictionaryUrl: 'https://example.com/dict.txt',
    };

    const manager = new ModelManager(config);
    expect(manager.getConfig()).toEqual(config);
  });

  it('한국어 모델 프리셋', () => {
    const manager = ModelManager.korean();
    const config = manager.getConfig();

    expect(config.recognitionUrl).toContain('korean');
  });

  it('영어 모델 프리셋', () => {
    const manager = ModelManager.english();
    const config = manager.getConfig();

    expect(config.recognitionUrl).toContain('en');
  });

  it('중국어 모델 프리셋', () => {
    const manager = ModelManager.chinese();
    const config = manager.getConfig();

    expect(config.dictionaryUrl).toContain('ppocr_keys');
  });

  it('getModelPaths가 경로 반환', () => {
    const manager = ModelManager.korean();
    const paths = manager.getModelPaths();

    expect(paths.detectionPath).toBeDefined();
    expect(paths.recognitionPath).toBeDefined();
    expect(paths.dictionaryPath).toBeDefined();
  });

  it('getModelPaths 캐싱 동작', () => {
    const manager = ModelManager.korean();
    const paths1 = manager.getModelPaths();
    const paths2 = manager.getModelPaths();

    expect(paths1).toBe(paths2);
  });
});
