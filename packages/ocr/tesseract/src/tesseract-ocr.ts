import type { OcrOptions, OcrPort, OcrRegion, OcrResult } from '@petrify/core';
import Tesseract, { createWorker, type Worker } from 'tesseract.js';

const DEFAULT_CORE_PATH = 'https://cdn.jsdelivr.net/npm/tesseract.js-core@7.0.0/';

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
      corePath: config.corePath ?? DEFAULT_CORE_PATH,
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

    const result = await this.worker?.recognize(new Blob([image]));
    if (!result) {
      return { text: '', confidence: 0, regions: [] };
    }
    const threshold = options?.confidenceThreshold ?? 0;

    const { text: rawText, confidence } = result.data;

    const textLines = (rawText ?? '')
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.length > 0);

    const regions: OcrRegion[] = textLines.map((line) => ({
      text: line,
      confidence: confidence ?? 0,
      x: 0,
      y: 0,
      width: 0,
      height: 0,
    }));

    const filteredRegions = regions.filter(
      (r) => r.confidence == null || r.confidence >= threshold,
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
