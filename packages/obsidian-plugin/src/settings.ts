import { DEFAULT_CONFIDENCE_THRESHOLD } from '@petrify/core';

export interface WatchMapping {
  watchDir: string;
  outputDir: string;
}

export interface OcrSettings {
  confidenceThreshold: number;
}

export interface PetrifySettings {
  watchMappings: WatchMapping[];
  ocr: OcrSettings;
}

export const DEFAULT_SETTINGS: PetrifySettings = {
  watchMappings: [],
  ocr: {
    confidenceThreshold: DEFAULT_CONFIDENCE_THRESHOLD,
  },
};
