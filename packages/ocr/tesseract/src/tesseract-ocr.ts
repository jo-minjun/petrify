import Tesseract, { createWorker, type Worker } from 'tesseract.js';
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

    const result = await this.worker!.recognize(new Uint8Array(image) as any);
    const threshold = options?.confidenceThreshold ?? 0;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data = result.data as any;

    // Tesseract.js v7: data.lines 없음, data.text로 직접 추출
    const textLines = (data.text as string ?? '')
      .split('\n')
      .map((line: string) => line.trim())
      .filter((line: string) => line.length > 0);

    const confidence = typeof data.confidence === 'number' ? data.confidence : undefined;

    const regions: OcrRegion[] = textLines.map((line: string) => ({
      text: line,
      confidence: confidence ?? 0,
      x: 0,
      y: 0,
      width: 0,
      height: 0,
    }));

    const filteredRegions = regions.filter(
      (r) => r.confidence == null || r.confidence >= threshold
    );
    const text = filteredRegions.map((r) => r.text).join('\n');

    return {
      text,
      confidence,
      regions: filteredRegions,
    };
  }

  async terminate(): Promise<void> {
    await this.worker?.terminate();
    this.worker = null;
  }
}
