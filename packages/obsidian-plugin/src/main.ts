import { Notice, Plugin, setIcon } from 'obsidian';
import type { DataAdapter } from 'obsidian';
import { ViwoodsParser } from '@petrify/parser-viwoods';
import { ChokidarWatcher } from '@petrify/watcher-chokidar';
import { ConversionPipeline } from '@petrify/core';
import type { WatcherPort, FileChangeEvent } from '@petrify/core';
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
  private isSyncing = false;
  private ribbonIconEl: HTMLElement | null = null;

  async onload(): Promise<void> {
    await this.loadSettings();
    await this.initializeOcr();
    this.initializePipeline();

    this.ribbonIconEl = this.addRibbonIcon('refresh-cw', 'Petrify: Sync', async () => {
      await this.syncAll();
    });

    this.addCommand({
      id: 'petrify-sync',
      name: 'Sync',
      callback: async () => {
        await this.syncAll();
      },
    });

    this.addSettingTab(
      new PetrifySettingsTab(this.app, this, {
        getSettings: () => this.settings,
        saveSettings: async (settings) => {
          this.settings = settings;
          await this.saveSettings();
          await this.restart();
        },
        saveDataOnly: async (settings) => {
          this.settings = settings;
          await this.saveSettings();
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
      if (!mapping.enabled) continue;
      if (!mapping.watchDir || !mapping.outputDir) continue;

      const watcher = new ChokidarWatcher(mapping.watchDir);

      watcher.onFileChange(async (event) => {
        console.log(`[Petrify] 파일 감지: ${event.name} (${event.extension})`);

        try {
          const notice = new Notice(`[Petrify] 변환 중: ${event.name}`, 0);
          const converted = await this.processFile(event, mapping.outputDir);

          if (converted) {
            notice.setMessage(`[Petrify] 변환 완료: ${event.name}`);
            console.log(`[Petrify] 변환 완료: ${event.name}`);
          } else {
            console.log(`[Petrify] 스킵: ${event.name} (미지원 확장자 또는 이미 최신)`);
            notice.hide();
          }

          setTimeout(() => notice.hide(), 3000);
        } catch (error) {
          console.error(`[Petrify] 변환 실패: ${event.name}`, error);
          new Notice(`[Petrify] 변환 실패: ${event.name}`);
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

  private async processFile(event: FileChangeEvent, outputDir: string): Promise<boolean> {
    const result = await this.pipeline.handleFileChange(event);
    if (!result) return false;
    const frontmatter = createFrontmatter({ source: event.id, mtime: event.mtime });
    const outputPath = this.getOutputPath(event.name, outputDir);
    await this.saveToVault(outputPath, frontmatter + result);
    return true;
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

  private async syncAll(): Promise<void> {
    if (this.isSyncing) {
      new Notice('Sync already in progress');
      return;
    }

    this.isSyncing = true;
    if (this.ribbonIconEl) {
      setIcon(this.ribbonIconEl, 'loader');
    }

    let synced = 0;
    let failed = 0;

    try {
      for (const mapping of this.settings.watchMappings) {
        if (!mapping.enabled) continue;
        if (!mapping.watchDir || !mapping.outputDir) continue;

        let entries: string[];
        try {
          entries = await fs.readdir(mapping.watchDir);
        } catch {
          failed++;
          continue;
        }

        for (const entry of entries) {
          const ext = path.extname(entry).toLowerCase();
          if (ext !== '.note') continue;

          const filePath = path.join(mapping.watchDir, entry);
          let stat: { mtimeMs: number };
          try {
            stat = await fs.stat(filePath);
          } catch {
            failed++;
            continue;
          }

          const event: FileChangeEvent = {
            id: filePath,
            name: entry,
            extension: ext,
            mtime: stat.mtimeMs,
            readData: () => fs.readFile(filePath).then((buf) => buf.buffer as ArrayBuffer),
          };

          try {
            const converted = await this.processFile(event, mapping.outputDir);
            if (converted) {
              synced++;
            }
          } catch {
            failed++;
          }
        }
      }
    } finally {
      this.isSyncing = false;
      if (this.ribbonIconEl) {
        setIcon(this.ribbonIconEl, 'refresh-cw');
      }
    }

    if (synced === 0 && failed === 0) {
      new Notice('No files to sync');
    } else if (failed === 0) {
      new Notice(`Synced ${synced} file(s)`);
    } else if (synced === 0) {
      new Notice(`Sync failed: ${failed} file(s) failed`);
    } else {
      new Notice(`Synced ${synced} file(s), ${failed} failed`);
    }
  }

  private async loadSettings(): Promise<void> {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
    this.settings.watchMappings = this.settings.watchMappings.map((m) => ({
      ...m,
      enabled: m.enabled ?? true,
    }));
  }

  private async saveSettings(): Promise<void> {
    await this.saveData(this.settings);
  }
}
