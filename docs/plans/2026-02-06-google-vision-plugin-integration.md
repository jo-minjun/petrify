# Google Vision OCR Plugin Integration

## Overview

`@petrify/ocr-google-vision` 어댑터를 Obsidian 플러그인에 통합하여 사용자가 OCR 제공자를 선택할 수 있게 한다.

## Requirements

- Settings UI에서 OCR 제공자 선택 (Tesseract / Google Vision)
- Google Vision API 키는 Settings UI에서 입력
- API 키 없이 Google Vision 선택 시 저장 버튼 비활성화
- 언어 힌트는 5개 옵션 중 복수 선택 (ko, en, ja, zh-CN, zh-TW)
- Google Vision 선택 시 Tesseract 초기화 건너뜀

## Design

### 1. Settings Structure (`settings.ts`)

```typescript
export type OcrProvider = 'tesseract' | 'google-vision';

export type LanguageHint = 'ko' | 'en' | 'ja' | 'zh-CN' | 'zh-TW';

export const LANGUAGE_HINT_OPTIONS: { value: LanguageHint; label: string }[] = [
  { value: 'ko', label: '한국어' },
  { value: 'en', label: 'English' },
  { value: 'ja', label: '日本語' },
  { value: 'zh-CN', label: '简体中文' },
  { value: 'zh-TW', label: '繁體中文' },
];

export interface OcrSettings {
  provider: OcrProvider;
  confidenceThreshold: number;
  googleVision: {
    apiKey: string;
    languageHints: LanguageHint[];
  };
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
};
```

### 2. OCR Initialization (`main.ts`)

```typescript
import { TesseractOcr } from '@petrify/ocr-tesseract';
import { GoogleVisionOcr } from '@petrify/ocr-google-vision';
import type { OcrPort } from '@petrify/core';

export default class PetrifyPlugin extends Plugin {
  private ocr: OcrPort | null = null;

  private async initializeOcr(): Promise<void> {
    const { provider, googleVision } = this.settings.ocr;

    if (provider === 'google-vision') {
      this.ocr = new GoogleVisionOcr({
        apiKey: googleVision.apiKey,
        languageHints: googleVision.languageHints,
      });
      return;
    }

    // Tesseract (default)
    const adapter = this.app.vault.adapter as FileSystemAdapter;
    const vaultPath = adapter.getBasePath();
    const pluginDir = path.join(vaultPath, '.obsidian', 'plugins', 'petrify');

    const workerPath = `file://${path.join(pluginDir, 'worker.min.js')}`;
    const corePath = 'https://cdn.jsdelivr.net/npm/tesseract.js-core@7.0.0/';

    this.ocr = new TesseractOcr({ lang: 'kor+eng', workerPath, corePath });
    await (this.ocr as TesseractOcr).initialize();
  }

  async onunload(): Promise<void> {
    await Promise.all(this.watchers.map((w) => w.stop()));
    if (this.ocr && 'terminate' in this.ocr) {
      await (this.ocr as TesseractOcr).terminate();
    }
  }
}
```

### 3. Settings Tab UI (`settings-tab.ts`)

OCR 섹션을 저장 버튼 패턴으로 변경:

```typescript
private displayOcrSettings(containerEl: HTMLElement): void {
  containerEl.createEl('h2', { text: 'OCR Settings' });

  const settings = this.callbacks.getSettings();

  let pendingProvider = settings.ocr.provider;
  let pendingApiKey = settings.ocr.googleVision.apiKey;
  let pendingLanguageHints = [...settings.ocr.googleVision.languageHints];
  let saveButton: HTMLButtonElement;

  const updateSaveButton = () => {
    const isGoogleVision = pendingProvider === 'google-vision';
    const hasApiKey = pendingApiKey.trim().length > 0;
    const canSave = !isGoogleVision || hasApiKey;
    saveButton.disabled = !canSave;
    saveButton.toggleClass('is-disabled', !canSave);
  };

  // 1. OCR Provider
  new Setting(containerEl)
    .setName('OCR Provider')
    .setDesc('Engine for text recognition')
    .addDropdown((dropdown) => {
      dropdown
        .addOption('tesseract', 'Tesseract (Local)')
        .addOption('google-vision', 'Google Vision API')
        .setValue(pendingProvider)
        .onChange((value) => {
          pendingProvider = value as OcrProvider;
          updateSaveButton();
          this.display();
        });
    });

  // 2. Google Vision API Key
  new Setting(containerEl)
    .setName('Google Vision API Key')
    .setDesc('Google Cloud Vision API key')
    .addText((text) => {
      text.inputEl.type = 'password';
      text
        .setPlaceholder('Enter API key')
        .setValue(pendingApiKey)
        .onChange((value) => {
          pendingApiKey = value;
          updateSaveButton();
        });
    });

  // 3. Language Hints (Google Vision only)
  if (pendingProvider === 'google-vision') {
    const languageSetting = new Setting(containerEl)
      .setName('Language Hints')
      .setDesc('Preferred languages for recognition (multiple selection)');

    for (const option of LANGUAGE_HINT_OPTIONS) {
      languageSetting.addToggle((toggle) => {
        toggle
          .setValue(pendingLanguageHints.includes(option.value))
          .setTooltip(option.label)
          .onChange((enabled) => {
            if (enabled) {
              pendingLanguageHints.push(option.value);
            } else {
              pendingLanguageHints = pendingLanguageHints.filter(h => h !== option.value);
            }
          });
      });
    }
  }

  // 4. Confidence Threshold
  new Setting(containerEl)
    .setName('Confidence Threshold')
    .setDesc('Minimum OCR confidence (0-100)')
    .addText((text) => {
      text.inputEl.type = 'number';
      text.inputEl.min = '0';
      text.inputEl.max = '100';
      text.inputEl.step = '1';
      text
        .setPlaceholder(String(DEFAULT_SETTINGS.ocr.confidenceThreshold))
        .setValue(String(settings.ocr.confidenceThreshold))
        .onChange((value) => {
          const num = Number(value);
          if (!Number.isNaN(num) && num >= 0 && num <= 100) {
            settings.ocr.confidenceThreshold = num;
          }
        });
    });

  // 5. Save Button
  new Setting(containerEl)
    .addButton((btn) => {
      saveButton = btn.buttonEl;
      btn
        .setButtonText('Save OCR Settings')
        .setCta()
        .onClick(async () => {
          settings.ocr.provider = pendingProvider;
          settings.ocr.googleVision.apiKey = pendingApiKey;
          settings.ocr.googleVision.languageHints = pendingLanguageHints;
          await this.callbacks.saveSettings(settings);
        });
    });

  updateSaveButton();
}
```

### 4. Package Dependencies (`package.json`)

```json
{
  "dependencies": {
    "@petrify/core": "workspace:*",
    "@petrify/parser-viwoods": "workspace:*",
    "@petrify/watcher-chokidar": "workspace:*",
    "@petrify/ocr-tesseract": "workspace:*",
    "@petrify/ocr-google-vision": "workspace:*"
  }
}
```

## Implementation Tasks

1. `settings.ts` - OcrProvider, LanguageHint 타입 및 기본값 추가
2. `main.ts` - OCR 초기화 로직 변경, import 추가
3. `settings-tab.ts` - OCR 섹션 저장 버튼 패턴으로 변경
4. `package.json` - `@petrify/ocr-google-vision` 의존성 추가
5. 테스트 및 빌드 검증
