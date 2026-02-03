# Obsidian Plugin Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 외부 폴더의 손글씨 파일(.note 등)을 감시하여 자동으로 Excalidraw 형식으로 변환하는 Obsidian 플러그인 구현

**Architecture:** Obsidian 플러그인이 chokidar로 외부 폴더를 감시하고, 파일 변경 시 @petrify/core의 convertToMdWithOcr()를 호출하여 변환. 결과는 vault 내 지정된 폴더에 .excalidraw.md로 저장. mtime 비교로 재변환 여부 결정.

**Tech Stack:** TypeScript, Obsidian API (1.11.0+), chokidar 5.0.0, @petrify/core, esbuild

**Design Document:** `docs/plans/2026-02-03-obsidian-plugin-design.md`

---

## Task 1: 패키지 스캐폴딩

**Files:**
- Create: `packages/obsidian-plugin/package.json`
- Create: `packages/obsidian-plugin/tsconfig.json`
- Create: `packages/obsidian-plugin/manifest.json`
- Create: `packages/obsidian-plugin/.gitignore`
- Modify: `pnpm-workspace.yaml`

**Step 1: pnpm-workspace.yaml에 obsidian-plugin 추가**

```yaml
packages:
  - 'packages/core'
  - 'packages/parser/*'
  - 'packages/ocr/*'
  - 'packages/obsidian-plugin'
```

**Step 2: package.json 생성**

```json
{
  "name": "@petrify/obsidian-plugin",
  "version": "0.1.0",
  "type": "module",
  "main": "main.js",
  "scripts": {
    "dev": "esbuild src/main.ts --bundle --outfile=main.js --external:obsidian --format=cjs --watch",
    "build": "esbuild src/main.ts --bundle --outfile=main.js --external:obsidian --format=cjs",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "@petrify/core": "workspace:*",
    "chokidar": "^5.0.0"
  },
  "devDependencies": {
    "@types/node": "^20.0.0",
    "esbuild": "^0.25.0",
    "obsidian": "^1.11.5",
    "typescript": "^5.9.0",
    "vitest": "^2.0.0"
  }
}
```

**Step 3: tsconfig.json 생성**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "declaration": false,
    "outDir": "dist",
    "rootDir": "src",
    "types": ["node"]
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules"]
}
```

**Step 4: manifest.json 생성**

```json
{
  "id": "petrify",
  "name": "Petrify",
  "version": "0.1.0",
  "minAppVersion": "1.11.0",
  "description": "Convert handwriting notes to Excalidraw with OCR support",
  "author": "minjun.jo",
  "isDesktopOnly": true
}
```

**Step 5: .gitignore 생성**

```
main.js
*.js.map
node_modules/
```

**Step 6: pnpm install 실행**

Run: `cd /Users/minjun.jo/Projects/me/petrify && pnpm install`

**Step 7: 커밋**

```bash
git add pnpm-workspace.yaml packages/obsidian-plugin/
git commit -m "chore: obsidian-plugin 패키지 스캐폴딩"
```

---

## Task 2: 설정 인터페이스 정의

**Files:**
- Create: `packages/obsidian-plugin/src/settings.ts`
- Create: `packages/obsidian-plugin/tests/settings.test.ts`

**Step 1: 테스트 파일 생성**

```typescript
import { describe, it, expect } from 'vitest';
import { DEFAULT_SETTINGS, type PetrifySettings } from '../src/settings.js';

describe('PetrifySettings', () => {
  it('DEFAULT_SETTINGS는 빈 watchMappings를 가진다', () => {
    expect(DEFAULT_SETTINGS.watchMappings).toEqual([]);
  });

  it('DEFAULT_SETTINGS는 기본 OCR 설정을 가진다', () => {
    expect(DEFAULT_SETTINGS.ocr.provider).toBe('gutenye');
    expect(DEFAULT_SETTINGS.ocr.confidenceThreshold).toBe(50);
  });
});
```

**Step 2: 테스트 실패 확인**

Run: `cd packages/obsidian-plugin && pnpm test`
Expected: FAIL - settings.js 없음

**Step 3: settings.ts 구현**

```typescript
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
```

**Step 4: vitest.config.ts 생성**

```typescript
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: false,
  },
});
```

**Step 5: 테스트 통과 확인**

Run: `cd packages/obsidian-plugin && pnpm test`
Expected: PASS

**Step 6: 커밋**

```bash
git add packages/obsidian-plugin/
git commit -m "feat(obsidian-plugin): 설정 인터페이스 정의"
```

---

## Task 3: Frontmatter 유틸리티

**Files:**
- Create: `packages/obsidian-plugin/src/utils/frontmatter.ts`
- Create: `packages/obsidian-plugin/tests/utils/frontmatter.test.ts`

**Step 1: 테스트 파일 생성**

```typescript
import { describe, it, expect } from 'vitest';
import {
  createFrontmatter,
  parseFrontmatter,
  type PetrifyFrontmatter,
} from '../../src/utils/frontmatter.js';

describe('frontmatter', () => {
  describe('createFrontmatter', () => {
    it('source와 mtime을 포함한 frontmatter 문자열을 생성한다', () => {
      const result = createFrontmatter({
        source: '/path/to/file.note',
        mtime: 1705315800000,
      });

      expect(result).toContain('petrify:');
      expect(result).toContain('source: /path/to/file.note');
      expect(result).toContain('mtime: 1705315800000');
      expect(result).toContain('excalidraw-plugin: parsed');
    });
  });

  describe('parseFrontmatter', () => {
    it('frontmatter에서 petrify 메타데이터를 파싱한다', () => {
      const content = `---
petrify:
  source: /path/to/file.note
  mtime: 1705315800000
excalidraw-plugin: parsed
---

# Content`;

      const result = parseFrontmatter(content);

      expect(result).toEqual({
        source: '/path/to/file.note',
        mtime: 1705315800000,
      });
    });

    it('petrify 메타데이터가 없으면 null을 반환한다', () => {
      const content = `---
excalidraw-plugin: parsed
---

# Content`;

      const result = parseFrontmatter(content);

      expect(result).toBeNull();
    });
  });
});
```

**Step 2: 테스트 실패 확인**

Run: `cd packages/obsidian-plugin && pnpm test`
Expected: FAIL

**Step 3: frontmatter.ts 구현**

```typescript
export interface PetrifyFrontmatter {
  source: string;
  mtime: number;
}

export function createFrontmatter(meta: PetrifyFrontmatter): string {
  return `---
petrify:
  source: ${meta.source}
  mtime: ${meta.mtime}
excalidraw-plugin: parsed
---

`;
}

export function parseFrontmatter(content: string): PetrifyFrontmatter | null {
  const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
  if (!frontmatterMatch) {
    return null;
  }

  const frontmatter = frontmatterMatch[1];
  const sourceMatch = frontmatter.match(/source:\s*(.+)/);
  const mtimeMatch = frontmatter.match(/mtime:\s*(\d+)/);

  if (!sourceMatch || !mtimeMatch) {
    return null;
  }

  return {
    source: sourceMatch[1].trim(),
    mtime: parseInt(mtimeMatch[1], 10),
  };
}
```

**Step 4: 테스트 통과 확인**

Run: `cd packages/obsidian-plugin && pnpm test`
Expected: PASS

**Step 5: 커밋**

```bash
git add packages/obsidian-plugin/
git commit -m "feat(obsidian-plugin): frontmatter 유틸리티 구현"
```

---

## Task 4: Parser Registry

**Files:**
- Create: `packages/obsidian-plugin/src/parser-registry.ts`
- Create: `packages/obsidian-plugin/tests/parser-registry.test.ts`

**Step 1: 테스트 파일 생성**

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import type { ParserPort, Note } from '@petrify/core';
import { ParserRegistry } from '../src/parser-registry.js';

class MockParser implements ParserPort {
  readonly extensions = ['.note', '.viwoods'];
  async parse(_data: ArrayBuffer): Promise<Note> {
    return { pages: [] };
  }
}

class AnotherMockParser implements ParserPort {
  readonly extensions = ['.rm'];
  async parse(_data: ArrayBuffer): Promise<Note> {
    return { pages: [] };
  }
}

describe('ParserRegistry', () => {
  let registry: ParserRegistry;

  beforeEach(() => {
    registry = new ParserRegistry();
  });

  it('파서를 등록하고 확장자로 찾을 수 있다', () => {
    const parser = new MockParser();
    registry.register(parser);

    expect(registry.getParserForExtension('.note')).toBe(parser);
    expect(registry.getParserForExtension('.viwoods')).toBe(parser);
  });

  it('지원하지 않는 확장자는 undefined를 반환한다', () => {
    const parser = new MockParser();
    registry.register(parser);

    expect(registry.getParserForExtension('.unknown')).toBeUndefined();
  });

  it('여러 파서를 등록할 수 있다', () => {
    const parser1 = new MockParser();
    const parser2 = new AnotherMockParser();
    registry.register(parser1);
    registry.register(parser2);

    expect(registry.getParserForExtension('.note')).toBe(parser1);
    expect(registry.getParserForExtension('.rm')).toBe(parser2);
  });

  it('지원하는 모든 확장자를 반환한다', () => {
    const parser1 = new MockParser();
    const parser2 = new AnotherMockParser();
    registry.register(parser1);
    registry.register(parser2);

    const extensions = registry.getSupportedExtensions();
    expect(extensions).toContain('.note');
    expect(extensions).toContain('.viwoods');
    expect(extensions).toContain('.rm');
  });
});
```

**Step 2: 테스트 실패 확인**

Run: `cd packages/obsidian-plugin && pnpm test`
Expected: FAIL

**Step 3: parser-registry.ts 구현**

```typescript
import type { ParserPort } from '@petrify/core';

export class ParserRegistry {
  private readonly parsers: Map<string, ParserPort> = new Map();

  register(parser: ParserPort): void {
    for (const ext of parser.extensions) {
      this.parsers.set(ext.toLowerCase(), parser);
    }
  }

  getParserForExtension(extension: string): ParserPort | undefined {
    return this.parsers.get(extension.toLowerCase());
  }

  getSupportedExtensions(): string[] {
    return Array.from(this.parsers.keys());
  }
}
```

**Step 4: 테스트 통과 확인**

Run: `cd packages/obsidian-plugin && pnpm test`
Expected: PASS

**Step 5: 커밋**

```bash
git add packages/obsidian-plugin/
git commit -m "feat(obsidian-plugin): ParserRegistry 구현"
```

---

## Task 5: Converter 구현

**Files:**
- Create: `packages/obsidian-plugin/src/converter.ts`
- Create: `packages/obsidian-plugin/tests/converter.test.ts`

**Step 1: 테스트 파일 생성**

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ParserPort, OcrPort, Note, OcrResult } from '@petrify/core';
import { Converter } from '../src/converter.js';
import { ParserRegistry } from '../src/parser-registry.js';

class MockParser implements ParserPort {
  readonly extensions = ['.note'];
  async parse(_data: ArrayBuffer): Promise<Note> {
    return {
      pages: [
        {
          width: 100,
          height: 100,
          strokes: [],
        },
      ],
    };
  }
}

class MockOcr implements OcrPort {
  async recognize(_image: ArrayBuffer): Promise<OcrResult> {
    return {
      text: 'test',
      regions: [{ text: 'test', x: 0, y: 0, width: 10, height: 10, confidence: 90 }],
    };
  }
}

describe('Converter', () => {
  let converter: Converter;
  let registry: ParserRegistry;
  let mockOcr: MockOcr;

  beforeEach(() => {
    registry = new ParserRegistry();
    registry.register(new MockParser());
    mockOcr = new MockOcr();
    converter = new Converter(registry, mockOcr, { confidenceThreshold: 50 });
  });

  it('지원하는 확장자의 파일을 변환한다', async () => {
    const data = new ArrayBuffer(0);
    const result = await converter.convert(data, '.note', {
      sourcePath: '/path/to/file.note',
      mtime: 1705315800000,
    });

    expect(result).toContain('petrify:');
    expect(result).toContain('source: /path/to/file.note');
    expect(result).toContain('mtime: 1705315800000');
    expect(result).toContain('excalidraw-plugin: parsed');
  });

  it('지원하지 않는 확장자는 에러를 던진다', async () => {
    const data = new ArrayBuffer(0);

    await expect(
      converter.convert(data, '.unknown', {
        sourcePath: '/path/to/file.unknown',
        mtime: 1705315800000,
      })
    ).rejects.toThrow('Unsupported file extension: .unknown');
  });
});
```

**Step 2: 테스트 실패 확인**

Run: `cd packages/obsidian-plugin && pnpm test`
Expected: FAIL

**Step 3: converter.ts 구현**

```typescript
import { convertToMdWithOcr } from '@petrify/core';
import type { OcrPort } from '@petrify/core';
import type { ParserRegistry } from './parser-registry.js';
import { createFrontmatter } from './utils/frontmatter.js';

export interface ConvertMeta {
  sourcePath: string;
  mtime: number;
}

export interface ConverterOptions {
  confidenceThreshold: number;
}

export class Converter {
  constructor(
    private readonly parserRegistry: ParserRegistry,
    private readonly ocr: OcrPort,
    private readonly options: ConverterOptions
  ) {}

  async convert(data: ArrayBuffer, extension: string, meta: ConvertMeta): Promise<string> {
    const parser = this.parserRegistry.getParserForExtension(extension);
    if (!parser) {
      throw new Error(`Unsupported file extension: ${extension}`);
    }

    const mdContent = await convertToMdWithOcr(data, parser, this.ocr, {
      ocrConfidenceThreshold: this.options.confidenceThreshold,
    });

    const frontmatter = createFrontmatter({
      source: meta.sourcePath,
      mtime: meta.mtime,
    });

    return frontmatter + mdContent;
  }
}
```

**Step 4: 테스트 통과 확인**

Run: `cd packages/obsidian-plugin && pnpm test`
Expected: PASS

**Step 5: 커밋**

```bash
git add packages/obsidian-plugin/
git commit -m "feat(obsidian-plugin): Converter 구현"
```

---

## Task 6: Watcher 구현

**Files:**
- Create: `packages/obsidian-plugin/src/watcher.ts`
- Create: `packages/obsidian-plugin/tests/watcher.test.ts`

**Step 1: 테스트 파일 생성**

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { PetrifyWatcher, type WatcherCallbacks } from '../src/watcher.js';

describe('PetrifyWatcher', () => {
  let watcher: PetrifyWatcher;
  let callbacks: WatcherCallbacks;

  beforeEach(() => {
    callbacks = {
      onFileChange: vi.fn(),
      onError: vi.fn(),
    };
    watcher = new PetrifyWatcher(['.note', '.viwoods'], callbacks);
  });

  afterEach(async () => {
    await watcher.close();
  });

  it('지원하는 확장자 목록을 반환한다', () => {
    expect(watcher.getSupportedExtensions()).toEqual(['.note', '.viwoods']);
  });

  it('파일이 지원되는 확장자인지 확인한다', () => {
    expect(watcher.isSupported('/path/to/file.note')).toBe(true);
    expect(watcher.isSupported('/path/to/file.VIWOODS')).toBe(true);
    expect(watcher.isSupported('/path/to/file.txt')).toBe(false);
  });

  it('감시 중인 디렉터리 목록을 반환한다', () => {
    expect(watcher.getWatchedDirs()).toEqual([]);
  });
});
```

**Step 2: 테스트 실패 확인**

Run: `cd packages/obsidian-plugin && pnpm test`
Expected: FAIL

**Step 3: watcher.ts 구현**

```typescript
import chokidar, { type FSWatcher } from 'chokidar';
import * as path from 'path';

export interface WatcherCallbacks {
  onFileChange: (filePath: string, mtime: number) => Promise<void>;
  onError: (error: Error, filePath?: string) => void;
}

export class PetrifyWatcher {
  private readonly watchers: Map<string, FSWatcher> = new Map();
  private readonly supportedExtensions: string[];
  private readonly callbacks: WatcherCallbacks;

  constructor(supportedExtensions: string[], callbacks: WatcherCallbacks) {
    this.supportedExtensions = supportedExtensions.map((ext) => ext.toLowerCase());
    this.callbacks = callbacks;
  }

  getSupportedExtensions(): string[] {
    return this.supportedExtensions;
  }

  isSupported(filePath: string): boolean {
    const ext = path.extname(filePath).toLowerCase();
    return this.supportedExtensions.includes(ext);
  }

  getWatchedDirs(): string[] {
    return Array.from(this.watchers.keys());
  }

  async watch(dir: string): Promise<void> {
    if (this.watchers.has(dir)) {
      return;
    }

    const watcher = chokidar.watch(dir, {
      persistent: true,
      ignoreInitial: false,
      alwaysStat: true,
      depth: 0,
    });

    watcher.on('add', (filePath, stats) => this.handleFileEvent(filePath, stats));
    watcher.on('change', (filePath, stats) => this.handleFileEvent(filePath, stats));
    watcher.on('error', (error) => this.callbacks.onError(error));

    this.watchers.set(dir, watcher);
  }

  private async handleFileEvent(
    filePath: string,
    stats: { mtimeMs: number } | undefined
  ): Promise<void> {
    if (!this.isSupported(filePath)) {
      return;
    }

    const mtime = stats?.mtimeMs ?? Date.now();

    try {
      await this.callbacks.onFileChange(filePath, mtime);
    } catch (error) {
      this.callbacks.onError(error as Error, filePath);
    }
  }

  async unwatch(dir: string): Promise<void> {
    const watcher = this.watchers.get(dir);
    if (watcher) {
      await watcher.close();
      this.watchers.delete(dir);
    }
  }

  async close(): Promise<void> {
    const promises = Array.from(this.watchers.values()).map((w) => w.close());
    await Promise.all(promises);
    this.watchers.clear();
  }
}
```

**Step 4: 테스트 통과 확인**

Run: `cd packages/obsidian-plugin && pnpm test`
Expected: PASS

**Step 5: 커밋**

```bash
git add packages/obsidian-plugin/
git commit -m "feat(obsidian-plugin): PetrifyWatcher 구현"
```

---

## Task 7: 설정 UI (SettingsTab)

**Files:**
- Create: `packages/obsidian-plugin/src/settings-tab.ts`

**Step 1: settings-tab.ts 구현**

```typescript
import { App, PluginSettingTab, Setting } from 'obsidian';
import type { PetrifySettings, WatchMapping } from './settings.js';

export interface SettingsTabCallbacks {
  getSettings: () => PetrifySettings;
  saveSettings: (settings: PetrifySettings) => Promise<void>;
}

export class PetrifySettingsTab extends PluginSettingTab {
  private readonly callbacks: SettingsTabCallbacks;

  constructor(app: App, plugin: { manifest: { id: string; name: string } }, callbacks: SettingsTabCallbacks) {
    super(app, plugin as any);
    this.callbacks = callbacks;
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();

    this.displayWatchMappings(containerEl);
    this.displayOcrSettings(containerEl);
  }

  private displayWatchMappings(containerEl: HTMLElement): void {
    containerEl.createEl('h2', { text: 'Watch Directories' });

    const settings = this.callbacks.getSettings();

    settings.watchMappings.forEach((mapping, index) => {
      const mappingContainer = containerEl.createDiv({ cls: 'petrify-mapping' });

      new Setting(mappingContainer)
        .setName(`Watch Directory ${index + 1}`)
        .setDesc('External folder to watch for handwriting files')
        .addText((text) =>
          text
            .setPlaceholder('/path/to/watch')
            .setValue(mapping.watchDir)
            .onChange(async (value) => {
              settings.watchMappings[index].watchDir = value;
              await this.callbacks.saveSettings(settings);
            })
        );

      new Setting(mappingContainer)
        .setName('Output Directory')
        .setDesc('Folder in vault for converted files')
        .addText((text) =>
          text
            .setPlaceholder('Handwritings/')
            .setValue(mapping.outputDir)
            .onChange(async (value) => {
              settings.watchMappings[index].outputDir = value;
              await this.callbacks.saveSettings(settings);
            })
        );

      new Setting(mappingContainer).addButton((btn) =>
        btn
          .setButtonText('Remove')
          .setWarning()
          .onClick(async () => {
            settings.watchMappings.splice(index, 1);
            await this.callbacks.saveSettings(settings);
            this.display();
          })
      );
    });

    new Setting(containerEl).addButton((btn) =>
      btn.setButtonText('Add Watch Directory').onClick(async () => {
        settings.watchMappings.push({ watchDir: '', outputDir: '' });
        await this.callbacks.saveSettings(settings);
        this.display();
      })
    );
  }

  private displayOcrSettings(containerEl: HTMLElement): void {
    containerEl.createEl('h2', { text: 'OCR Settings' });

    const settings = this.callbacks.getSettings();

    new Setting(containerEl)
      .setName('OCR Provider')
      .setDesc('Select OCR engine')
      .addDropdown((dropdown) =>
        dropdown
          .addOption('gutenye', 'Gutenye (Local)')
          .addOption('google-vision', 'Google Vision API')
          .addOption('azure-ocr', 'Azure OCR')
          .setValue(settings.ocr.provider)
          .onChange(async (value) => {
            settings.ocr.provider = value as any;
            await this.callbacks.saveSettings(settings);
            this.display();
          })
      );

    new Setting(containerEl)
      .setName('Confidence Threshold')
      .setDesc('Minimum OCR confidence (0-100)')
      .addSlider((slider) =>
        slider
          .setLimits(0, 100, 5)
          .setValue(settings.ocr.confidenceThreshold)
          .setDynamicTooltip()
          .onChange(async (value) => {
            settings.ocr.confidenceThreshold = value;
            await this.callbacks.saveSettings(settings);
          })
      );

    this.displayProviderConfig(containerEl, settings);
  }

  private displayProviderConfig(containerEl: HTMLElement, settings: PetrifySettings): void {
    if (settings.ocr.provider === 'google-vision') {
      new Setting(containerEl)
        .setName('Google Vision API Key')
        .setDesc('API key for Google Cloud Vision')
        .addText((text) =>
          text
            .setPlaceholder('Enter API key')
            .setValue(settings.ocr.providerConfig.googleVision?.apiKey ?? '')
            .onChange(async (value) => {
              settings.ocr.providerConfig.googleVision = { apiKey: value };
              await this.callbacks.saveSettings(settings);
            })
        );
    }

    if (settings.ocr.provider === 'azure-ocr') {
      new Setting(containerEl)
        .setName('Azure OCR API Key')
        .addText((text) =>
          text
            .setPlaceholder('Enter API key')
            .setValue(settings.ocr.providerConfig.azureOcr?.apiKey ?? '')
            .onChange(async (value) => {
              settings.ocr.providerConfig.azureOcr = {
                ...settings.ocr.providerConfig.azureOcr,
                apiKey: value,
                endpoint: settings.ocr.providerConfig.azureOcr?.endpoint ?? '',
              };
              await this.callbacks.saveSettings(settings);
            })
        );

      new Setting(containerEl)
        .setName('Azure OCR Endpoint')
        .addText((text) =>
          text
            .setPlaceholder('https://your-resource.cognitiveservices.azure.com')
            .setValue(settings.ocr.providerConfig.azureOcr?.endpoint ?? '')
            .onChange(async (value) => {
              settings.ocr.providerConfig.azureOcr = {
                ...settings.ocr.providerConfig.azureOcr,
                apiKey: settings.ocr.providerConfig.azureOcr?.apiKey ?? '',
                endpoint: value,
              };
              await this.callbacks.saveSettings(settings);
            })
        );
    }
  }
}
```

**Step 2: 타입 체크**

Run: `cd packages/obsidian-plugin && pnpm typecheck`
Expected: 에러 없음

**Step 3: 커밋**

```bash
git add packages/obsidian-plugin/
git commit -m "feat(obsidian-plugin): 설정 UI 구현"
```

---

## Task 8: 메인 플러그인 클래스

**Files:**
- Create: `packages/obsidian-plugin/src/main.ts`

**Step 1: main.ts 구현**

```typescript
import { Notice, Plugin } from 'obsidian';
import * as fs from 'fs/promises';
import * as path from 'path';
import { DEFAULT_SETTINGS, type PetrifySettings } from './settings.js';
import { PetrifySettingsTab } from './settings-tab.js';
import { ParserRegistry } from './parser-registry.js';
import { Converter } from './converter.js';
import { PetrifyWatcher } from './watcher.js';
import { parseFrontmatter } from './utils/frontmatter.js';

export default class PetrifyPlugin extends Plugin {
  settings!: PetrifySettings;
  private watcher: PetrifyWatcher | null = null;
  private parserRegistry!: ParserRegistry;
  private converter!: Converter;

  async onload(): Promise<void> {
    await this.loadSettings();

    this.parserRegistry = new ParserRegistry();
    this.registerParsers();

    this.initializeConverter();
    this.initializeWatcher();

    this.addSettingTab(
      new PetrifySettingsTab(this.app, this, {
        getSettings: () => this.settings,
        saveSettings: async (settings) => {
          this.settings = settings;
          await this.saveSettings();
          await this.restartWatcher();
        },
      })
    );

    await this.startWatcher();
  }

  async onunload(): Promise<void> {
    await this.watcher?.close();
  }

  private registerParsers(): void {
    // 동적으로 파서 로드 시도
    try {
      // @petrify/parser-viwoods가 설치되어 있으면 등록
      const { ViwoodsParser } = require('@petrify/parser-viwoods');
      this.parserRegistry.register(new ViwoodsParser());
    } catch {
      console.log('[Petrify] @petrify/parser-viwoods not found');
    }
  }

  private initializeConverter(): void {
    const ocr = this.createOcr();
    this.converter = new Converter(this.parserRegistry, ocr, {
      confidenceThreshold: this.settings.ocr.confidenceThreshold,
    });
  }

  private createOcr(): any {
    const provider = this.settings.ocr.provider;

    if (provider === 'gutenye') {
      try {
        const { GutenyeOcr } = require('@petrify/ocr-gutenye');
        return new GutenyeOcr();
      } catch {
        console.error('[Petrify] @petrify/ocr-gutenye not found');
        throw new Error('OCR provider not available');
      }
    }

    // TODO: 다른 OCR provider 구현
    throw new Error(`Unsupported OCR provider: ${provider}`);
  }

  private initializeWatcher(): void {
    const extensions = this.parserRegistry.getSupportedExtensions();

    this.watcher = new PetrifyWatcher(extensions, {
      onFileChange: async (filePath, mtime) => {
        await this.handleFileChange(filePath, mtime);
      },
      onError: (error, filePath) => {
        const message = filePath
          ? `[Petrify] 변환 실패: ${path.basename(filePath)}\n${error.message}`
          : `[Petrify] 오류: ${error.message}`;
        new Notice(message);
        console.error('[Petrify]', error);
      },
    });
  }

  private async handleFileChange(filePath: string, mtime: number): Promise<void> {
    const mapping = this.findMappingForFile(filePath);
    if (!mapping) {
      return;
    }

    const outputPath = this.getOutputPath(filePath, mapping);

    if (await this.shouldSkipConversion(outputPath, mtime)) {
      return;
    }

    const data = await fs.readFile(filePath);
    const extension = path.extname(filePath);

    const result = await this.converter.convert(data.buffer as ArrayBuffer, extension, {
      sourcePath: filePath,
      mtime,
    });

    await this.saveToVault(outputPath, result);
  }

  private findMappingForFile(filePath: string): { watchDir: string; outputDir: string } | undefined {
    return this.settings.watchMappings.find((m) => filePath.startsWith(m.watchDir));
  }

  private getOutputPath(filePath: string, mapping: { watchDir: string; outputDir: string }): string {
    const fileName = path.basename(filePath, path.extname(filePath));
    return path.join(mapping.outputDir, `${fileName}.excalidraw.md`);
  }

  private async shouldSkipConversion(outputPath: string, sourceMtime: number): Promise<boolean> {
    const vaultPath = this.app.vault.adapter.getBasePath();
    const fullPath = path.join(vaultPath, outputPath);

    try {
      const content = await fs.readFile(fullPath, 'utf-8');
      const meta = parseFrontmatter(content);

      if (meta && meta.mtime >= sourceMtime) {
        return true;
      }
    } catch {
      // 파일이 없으면 변환 필요
    }

    return false;
  }

  private async saveToVault(outputPath: string, content: string): Promise<void> {
    const dir = path.dirname(outputPath);

    if (!(await this.app.vault.adapter.exists(dir))) {
      await this.app.vault.createFolder(dir);
    }

    if (await this.app.vault.adapter.exists(outputPath)) {
      await this.app.vault.adapter.write(outputPath, content);
    } else {
      await this.app.vault.create(outputPath, content);
    }
  }

  private async startWatcher(): Promise<void> {
    for (const mapping of this.settings.watchMappings) {
      if (mapping.watchDir) {
        await this.watcher?.watch(mapping.watchDir);
      }
    }
  }

  private async restartWatcher(): Promise<void> {
    await this.watcher?.close();
    this.initializeConverter();
    this.initializeWatcher();
    await this.startWatcher();
  }

  private async loadSettings(): Promise<void> {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }

  private async saveSettings(): Promise<void> {
    await this.saveData(this.settings);
  }
}
```

**Step 2: 빌드 테스트**

Run: `cd packages/obsidian-plugin && pnpm build`
Expected: main.js 생성

**Step 3: 커밋**

```bash
git add packages/obsidian-plugin/
git commit -m "feat(obsidian-plugin): 메인 플러그인 클래스 구현"
```

---

## Task 9: 통합 테스트 및 마무리

**Files:**
- Create: `packages/obsidian-plugin/src/index.ts`
- Modify: `packages/obsidian-plugin/package.json` (test script 확인)

**Step 1: index.ts 생성 (export용)**

```typescript
export { default } from './main.js';
export * from './settings.js';
export * from './parser-registry.js';
export * from './converter.js';
export * from './watcher.js';
```

**Step 2: 전체 테스트 실행**

Run: `cd /Users/minjun.jo/Projects/me/petrify && pnpm test`
Expected: 모든 패키지 테스트 통과

**Step 3: 전체 빌드 실행**

Run: `cd /Users/minjun.jo/Projects/me/petrify && pnpm build`
Expected: 모든 패키지 빌드 성공

**Step 4: 타입 체크**

Run: `cd /Users/minjun.jo/Projects/me/petrify && pnpm typecheck`
Expected: 에러 없음

**Step 5: 커밋**

```bash
git add packages/obsidian-plugin/
git commit -m "feat(obsidian-plugin): 통합 완료"
```

---

## Task 10: 마일스톤 업데이트

**Files:**
- Modify: `docs/milestones/v1.0-roadmap.md`

**Step 1: 마일스톤 파일 업데이트**

```markdown
# Petrify v1.0 로드맵

## Phase 1: 모노레포 구조 전환 ✅
- [x] pnpm workspace 설정
- [x] @petrify/core 패키지 생성
- [x] @petrify/parser-viwoods 패키지 분리
- [x] 포트 인터페이스 정의 (ParserPort, OcrPort)

## Phase 2: OCR 기본 지원 ✅
- [x] OcrPort 상세 설계 (OcrOptions, confidence 필드)
- [x] @petrify/ocr-gutenye 구현 (@gutenye/ocr-browser 래핑)
- [x] 손글씨 인식 → Excalidraw 텍스트 요소 변환 (## OCR Text 섹션)

## Phase 3: Obsidian 플러그인 ✅
- [x] 플러그인 기본 구조 (@petrify/obsidian-plugin)
- [x] 설정 UI (감시 폴더 경로, OCR provider 선택)
- [x] 외부 폴더 Watcher (chokidar)
- [x] 자동 변환 파이프라인

## Phase 4: 드래그 & 드롭
- [ ] Obsidian 플러그인에 드래그 & 드롭 지원 추가

## Phase 5: 다중 페이지 OCR
- [ ] core에서 다중 페이지 OCR 처리 구현
- [ ] 플러그인 연동

## Phase 6: 삭제 동기화
- [ ] 원본 파일 삭제 시 변환 파일도 삭제

## Phase 7: 스트로크 그룹 기반 OCR
- [ ] 인접 스트로크 그룹핑 알고리즘
- [ ] 그룹별 개별 OCR 처리
- [ ] 그룹 위치 기반 텍스트 요소 배치

## Phase 8: 추가 파서
- [ ] @petrify/parser-supernote
- [ ] @petrify/parser-remarkable
```

**Step 2: 커밋**

```bash
git add docs/milestones/v1.0-roadmap.md
git commit -m "docs: 마일스톤 Phase 3 완료 및 Phase 4-8 추가"
```

---

## 요약

| Task | 설명 | 예상 커밋 |
|------|------|-----------|
| 1 | 패키지 스캐폴딩 | `chore: obsidian-plugin 패키지 스캐폴딩` |
| 2 | 설정 인터페이스 | `feat: 설정 인터페이스 정의` |
| 3 | Frontmatter 유틸리티 | `feat: frontmatter 유틸리티 구현` |
| 4 | Parser Registry | `feat: ParserRegistry 구현` |
| 5 | Converter | `feat: Converter 구현` |
| 6 | Watcher | `feat: PetrifyWatcher 구현` |
| 7 | 설정 UI | `feat: 설정 UI 구현` |
| 8 | 메인 플러그인 | `feat: 메인 플러그인 클래스 구현` |
| 9 | 통합 테스트 | `feat: 통합 완료` |
| 10 | 마일스톤 업데이트 | `docs: 마일스톤 업데이트` |
