export interface WatchMapping {
  watchDir: string;
  outputDir: string;
}

export interface OcrProviderConfig {
  googleVision?: { apiKey: string };
  azureOcr?: { apiKey: string; endpoint: string };
}

export interface OcrSettings {
  provider: 'gutenye' | 'google-vision' | 'azure-ocr';
  confidenceThreshold: number;
  providerConfig: OcrProviderConfig;
}

export interface PetrifySettings {
  watchMappings: WatchMapping[];
  ocr: OcrSettings;
}

export const DEFAULT_SETTINGS: PetrifySettings = {
  watchMappings: [],
  ocr: {
    provider: 'gutenye',
    confidenceThreshold: 50,
    providerConfig: {},
  },
};
