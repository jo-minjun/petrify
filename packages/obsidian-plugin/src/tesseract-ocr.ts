import Tesseract, { createWorker, type Worker, type Line } from 'tesseract.js';
import type { OcrPort, OcrResult, OcrRegion, OcrOptions } from '@petrify/core';

export interface TesseractOcrConfig {
  lang: string;
  workerPath?: string;
  corePath?: string;
  langPath?: string;
}

export class TesseractOcr implements OcrPort {
  private worker: Worker | null = null;
  private readonly config: TesseractOcrConfig;

  constructor(config: Partial<TesseractOcrConfig> = {}) {
    this.config = {
      lang: config.lang ?? 'kor+eng',
      workerPath: config.workerPath,
      corePath: config.corePath,
      langPath: config.langPath,
    };
  }

  async initialize(): Promise<void> {
    this.worker = await createWorker(this.config.lang, Tesseract.OEM.LSTM_ONLY, {
      workerPath: this.config.workerPath,
      corePath: this.config.corePath,
      langPath: this.config.langPath,
    });
  }

  async recognize(image: ArrayBuffer, options?: OcrOptions): Promise<OcrResult> {
    if (!this.worker) {
      await this.initialize();
    }

    const result = await this.worker!.recognize(Buffer.from(image));
    const threshold = options?.confidenceThreshold ?? 0;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data = result.data as any;
    const lines = (data.lines ?? []) as Line[];
    const allRegions: OcrRegion[] = lines.map((line) => ({
      text: line.text.trim(),
      confidence: line.confidence ?? 0,
      x: line.bbox.x0,
      y: line.bbox.y0,
      width: line.bbox.x1 - line.bbox.x0,
      height: line.bbox.y1 - line.bbox.y0,
    }));

    const regions = allRegions.filter(
      (r) => r.confidence == null || r.confidence >= threshold
    );
    const text = regions.map((r) => r.text).join('\n');

    const regionsWithConfidence = regions.filter((r) => r.confidence != null);
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

  async terminate(): Promise<void> {
    await this.worker?.terminate();
    this.worker = null;
  }
}
