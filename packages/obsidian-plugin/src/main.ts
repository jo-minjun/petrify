import { Notice, Plugin } from 'obsidian';
import type { DataAdapter } from 'obsidian';
import { ViwoodsParser } from '@petrify/parser-viwoods';
import * as fs from 'fs/promises';
import * as path from 'path';
import { DEFAULT_SETTINGS, type PetrifySettings } from './settings.js';
import { PetrifySettingsTab } from './settings-tab.js';
import { ParserRegistry } from './parser-registry.js';
import { Converter } from './converter.js';
import { PetrifyWatcher } from './watcher.js';
import { parseFrontmatter } from './utils/frontmatter.js';
import { TesseractOcr } from './tesseract-ocr.js';

interface FileSystemAdapter extends DataAdapter {
  getBasePath(): string;
}

export default class PetrifyPlugin extends Plugin {
  settings!: PetrifySettings;
  private watcher: PetrifyWatcher | null = null;
  private parserRegistry!: ParserRegistry;
  private converter!: Converter;
  private ocr: TesseractOcr | null = null;

  async onload(): Promise<void> {
    await this.loadSettings();

    this.parserRegistry = new ParserRegistry();
    this.registerParsers();

    // TODO(2026-02-04, minjun.jo): Tesseract.js Worker 경로 문제 해결 필요
    // await this.initializeOcr();
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
    await this.ocr?.terminate();
  }

  private registerParsers(): void {
    this.parserRegistry.register(new ViwoodsParser());
  }

  private async initializeOcr(): Promise<void> {
    // CDN에서 worker/core를 가져옴 (로컬 파일 경로가 app:// URL로 변환되어 Worker 생성 실패)
    this.ocr = new TesseractOcr({
      lang: 'kor+eng',
    });

    await this.ocr.initialize();
    console.log('[Petrify] Tesseract OCR initialized');
  }

  private initializeConverter(): void {
    this.converter = new Converter(this.parserRegistry, this.ocr, {
      confidenceThreshold: this.settings.ocr.confidenceThreshold,
    });
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
    const adapter = this.app.vault.adapter as FileSystemAdapter;
    const vaultPath = adapter.getBasePath();
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
