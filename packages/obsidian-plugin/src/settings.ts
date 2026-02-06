import { DEFAULT_CONFIDENCE_THRESHOLD } from '@petrify/core';

export type OcrProvider = 'tesseract' | 'google-vision';

export type LanguageHint = 'ko' | 'en' | 'ja' | 'zh-CN' | 'zh-TW';

export const LANGUAGE_HINT_OPTIONS: { value: LanguageHint; label: string }[] = [
  { value: 'ko', label: '한국어' },
  { value: 'en', label: 'English' },
  { value: 'ja', label: '日本語' },
  { value: 'zh-CN', label: '简体中文' },
  { value: 'zh-TW', label: '繁體中文' },
];

export type OutputFormat = 'excalidraw' | 'markdown';

export interface WatchMapping {
  watchDir: string;
  outputDir: string;
  enabled: boolean;
  parserId: string;
}

export interface OcrSettings {
  provider: OcrProvider;
  confidenceThreshold: number;
  googleVision: {
    apiKey: string;
    languageHints: LanguageHint[];
  };
}

export interface PetrifySettings {
  watchMappings: WatchMapping[];
  ocr: OcrSettings;
  deleteConvertedOnSourceDelete: boolean;
  outputFormat: OutputFormat;
}

export const DEFAULT_SETTINGS: PetrifySettings = {
  watchMappings: [],
  ocr: {
    provider: 'tesseract',
    confidenceThreshold: DEFAULT_CONFIDENCE_THRESHOLD,
    googleVision: {
      apiKey: '',
      languageHints: ['ko', 'en'],
    },
  },
  deleteConvertedOnSourceDelete: false,
  outputFormat: 'excalidraw',
};
