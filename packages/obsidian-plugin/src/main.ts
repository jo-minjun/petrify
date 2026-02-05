import { Notice, Plugin } from 'obsidian';
import type { DataAdapter } from 'obsidian';
import { ViwoodsParser } from '@petrify/parser-viwoods';
import { ChokidarWatcher } from '@petrify/watcher-chokidar';
import { ConversionPipeline } from '@petrify/core';
import type { WatcherPort } from '@petrify/core';
import * as fs from 'fs/promises';
import * as path from 'path';
import { DEFAULT_SETTINGS, type PetrifySettings } from './settings.js';
import { PetrifySettingsTab } from './settings-tab.js';
import { TesseractOcr } from '@petrify/ocr-tesseract';
import { FrontmatterConversionState } from './frontmatter-conversion-state.js';
import { createFrontmatter } from './utils/frontmatter.js';

interface FileSystemAdapter extends DataAdapter {
  getBasePath(): string;
}

export default class PetrifyPlugin extends Plugin {
  settings!: PetrifySettings;
  private watchers: WatcherPort[] = [];
  private pipeline!: ConversionPipeline;
  private ocr: TesseractOcr | null = null;

  async onload(): Promise<void> {
    await this.loadSettings();
    await this.initializeOcr();
    this.initializePipeline();

    this.addSettingTab(
      new PetrifySettingsTab(this.app, this, {
        getSettings: () => this.settings,
        saveSettings: async (settings) => {
          this.settings = settings;
          await this.saveSettings();
          await this.restart();
        },
      })
    );

    await this.startWatchers();
  }

  async onunload(): Promise<void> {
    await Promise.all(this.watchers.map((w) => w.stop()));
    await this.ocr?.terminate();
  }

  private async initializeOcr(): Promise<void> {
    const adapter = this.app.vault.adapter as FileSystemAdapter;
    const vaultPath = adapter.getBasePath();
    const pluginDir = path.join(vaultPath, '.obsidian', 'plugins', 'petrify');

    const workerPath = `file://${path.join(pluginDir, 'worker.min.js')}`;
    const corePath = 'https://cdn.jsdelivr.net/npm/tesseract.js-core@7.0.0/';

    this.ocr = new TesseractOcr({ lang: 'kor+eng', workerPath, corePath });
    await this.ocr.initialize();
  }

  private initializePipeline(): void {
    const adapter = this.app.vault.adapter as FileSystemAdapter;
    const vaultPath = adapter.getBasePath();

    const conversionState = new FrontmatterConversionState(async (id: string) => {
      const outputPath = this.getOutputPathForId(id);
      const fullPath = path.join(vaultPath, outputPath);
      return fs.readFile(fullPath, 'utf-8');
    });

    this.pipeline = new ConversionPipeline(
      [new ViwoodsParser()],
      this.ocr,
      conversionState,
      { confidenceThreshold: this.settings.ocr.confidenceThreshold },
    );
  }

  private async startWatchers(): Promise<void> {
    for (const mapping of this.settings.watchMappings) {
      if (!mapping.watchDir) continue;

      const watcher = new ChokidarWatcher(mapping.watchDir);

      watcher.onFileChange(async (event) => {
        const result = await this.pipeline.handleFileChange(event);
        if (result) {
          const frontmatter = createFrontmatter({ source: event.id, mtime: event.mtime });
          const outputPath = this.getOutputPath(event.name, mapping.outputDir);
          await this.saveToVault(outputPath, frontmatter + result);
        }
      });

      watcher.onError((error) => {
        new Notice(`[Petrify] 오류: ${error.message}`);
        console.error('[Petrify]', error);
      });

      await watcher.start();
      this.watchers.push(watcher);
    }
  }

  private getOutputPathForId(id: string): string {
    const mapping = this.settings.watchMappings.find((m) => id.startsWith(m.watchDir));
    if (!mapping) return '';
    const fileName = path.basename(id, path.extname(id));
    return path.join(mapping.outputDir, `${fileName}.excalidraw.md`);
  }

  private getOutputPath(name: string, outputDir: string): string {
    const fileName = path.basename(name, path.extname(name));
    return path.join(outputDir, `${fileName}.excalidraw.md`);
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

  private async restart(): Promise<void> {
    await Promise.all(this.watchers.map((w) => w.stop()));
    this.watchers = [];
    this.initializePipeline();
    await this.startWatchers();
  }

  private async loadSettings(): Promise<void> {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }

  private async saveSettings(): Promise<void> {
    await this.saveData(this.settings);
  }
}
