import { DEFAULT_CONFIDENCE_THRESHOLD } from '@petrify/core';

export interface WatchMapping {
  watchDir: string;
  outputDir: string;
  enabled: boolean;
}

export interface OcrSettings {
  confidenceThreshold: number;
}

export interface PetrifySettings {
  watchMappings: WatchMapping[];
  ocr: OcrSettings;
  deleteConvertedOnSourceDelete: boolean;
}

export const DEFAULT_SETTINGS: PetrifySettings = {
  watchMappings: [],
  ocr: {
    confidenceThreshold: DEFAULT_CONFIDENCE_THRESHOLD,
  },
  deleteConvertedOnSourceDelete: false,
};
