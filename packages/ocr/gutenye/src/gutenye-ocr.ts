import Ocr, { type Line } from '@gutenye/ocr-browser';
import type { OcrPort, OcrResult, OcrRegion, OcrOptions } from '@petrify/core';
import { ModelManager } from './model-manager.js';

// @gutenye/ocr-browser의 Line 타입에는 score가 없고 mean이 있음
// 실제 사용 시 score 필드가 있을 수 있으므로 확장 타입 정의
interface TextLine extends Line {
  score?: number;
}

export class GutenyeOcr implements OcrPort {
  private ocr: Awaited<ReturnType<typeof Ocr.create>> | null = null;
  private readonly modelManager: ModelManager;

  private constructor(modelManager: ModelManager) {
    this.modelManager = modelManager;
  }

  static async create(modelManager?: ModelManager): Promise<GutenyeOcr> {
    const manager = modelManager ?? ModelManager.korean();
    const instance = new GutenyeOcr(manager);
    await instance.initialize();
    return instance;
  }

  private async initialize(): Promise<void> {
    const paths = this.modelManager.getModelPaths();

    this.ocr = await Ocr.create({
      models: {
        detectionPath: paths.detectionPath,
        recognitionPath: paths.recognitionPath,
        dictionaryPath: paths.dictionaryPath,
      },
    });
  }

  async recognize(image: ArrayBuffer, options?: OcrOptions): Promise<OcrResult> {
    if (!this.ocr) {
      throw new Error('OCR이 초기화되지 않았습니다');
    }

    const threshold = options?.confidenceThreshold;
    const lines = (await this.ocr.detect(this.arrayBufferToDataUrl(image))) as TextLine[];

    const allRegions = lines.map((line) => this.textLineToRegion(line));

    // confidence가 있고 threshold가 설정된 경우에만 필터링
    const regions = threshold !== undefined
      ? allRegions.filter((r) => r.confidence === undefined || r.confidence >= threshold)
      : allRegions;

    const text = regions.map((r) => r.text).join('\n');

    // confidence가 있는 region들의 평균 계산
    const regionsWithConfidence = regions.filter((r) => r.confidence !== undefined);
    const avgConfidence =
      regionsWithConfidence.length > 0
        ? regionsWithConfidence.reduce((sum, r) => sum + r.confidence!, 0) / regionsWithConfidence.length
        : undefined;

    return {
      text,
      confidence: avgConfidence,
      regions,
    };
  }

  private arrayBufferToDataUrl(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return `data:image/png;base64,${btoa(binary)}`;
  }

  /** PaddleOCR의 0-1 스케일을 0-100으로 변환 */
  private getConfidence(line: TextLine): number {
    const raw = line.score ?? line.mean;
    return raw * 100;
  }

  private textLineToRegion(line: TextLine): OcrRegion {
    const box = line.box ?? [[0, 0], [0, 0], [0, 0], [0, 0]];
    const minX = Math.min(...box.map((p) => p[0]));
    const maxX = Math.max(...box.map((p) => p[0]));
    const minY = Math.min(...box.map((p) => p[1]));
    const maxY = Math.max(...box.map((p) => p[1]));

    return {
      text: line.text,
      confidence: this.getConfidence(line),
      x: minX,
      y: minY,
      width: maxX - minX,
      height: maxY - minY,
    };
  }
}
