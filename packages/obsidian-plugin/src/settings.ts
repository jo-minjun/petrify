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

export interface LocalWatchMapping {
  watchDir: string;
  outputDir: string;
  enabled: boolean;
  parserId: string;
}

export interface GoogleDriveMapping {
  folderId: string;
  folderName: string;
  outputDir: string;
  enabled: boolean;
  parserId: string;
}

export interface LocalWatchSettings {
  enabled: boolean;
  mappings: LocalWatchMapping[];
}

export interface GoogleDriveSettings {
  enabled: boolean;
  clientId: string;
  autoPolling: boolean;
  pollIntervalMinutes: number;
  mappings: GoogleDriveMapping[];
}

export interface OcrSettings {
  provider: OcrProvider;
  confidenceThreshold: number;
  googleVision: {
    languageHints: LanguageHint[];
  };
}

export interface PetrifySettings {
  outputFormat: OutputFormat;
  localWatch: LocalWatchSettings;
  googleDrive: GoogleDriveSettings;
  ocr: OcrSettings;
}

export const DEFAULT_SETTINGS: PetrifySettings = {
  outputFormat: 'excalidraw',
  localWatch: {
    enabled: false,
    mappings: [],
  },
  googleDrive: {
    enabled: false,
    clientId: '',
    autoPolling: true,
    pollIntervalMinutes: 5,
    mappings: [],
  },
  ocr: {
    provider: 'tesseract',
    confidenceThreshold: DEFAULT_CONFIDENCE_THRESHOLD,
    googleVision: {
      languageHints: ['ko', 'en'],
    },
  },
};
