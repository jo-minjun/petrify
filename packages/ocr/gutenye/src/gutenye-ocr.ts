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

    const threshold = options?.confidenceThreshold ?? 0;
    const lines = (await this.ocr.detect(this.arrayBufferToDataUrl(image))) as TextLine[];

    const regions: OcrRegion[] = lines
      .filter((line) => this.getConfidence(line) >= threshold)
      .map((line) => this.textLineToRegion(line));

    const text = regions.map((r) => r.text).join('\n');
    const avgConfidence =
      regions.length > 0
        ? regions.reduce((sum, r) => sum + r.confidence, 0) / regions.length
        : 0;

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

  private getConfidence(line: TextLine): number {
    return line.score ?? line.mean;
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
