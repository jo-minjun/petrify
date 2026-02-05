import type { OcrPort, OcrResult, OcrOptions } from '@petrify/core';

export interface GoogleVisionOcrConfig {
  readonly apiKey: string;
  readonly languageHints?: string[];
}

export class GoogleVisionOcr implements OcrPort {
  private readonly config: GoogleVisionOcrConfig;

  constructor(config: GoogleVisionOcrConfig) {
    this.config = config;
  }

  async recognize(_image: ArrayBuffer, _options?: OcrOptions): Promise<OcrResult> {
    throw new Error('Not implemented');
  }
}
