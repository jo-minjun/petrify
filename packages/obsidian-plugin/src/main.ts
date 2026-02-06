import * as fs from 'fs/promises';
import * as path from 'path';
import { Plugin, setIcon } from 'obsidian';
import type { DataAdapter } from 'obsidian';
import { ConversionPipeline } from '@petrify/core';
import type { FileChangeEvent, FileGeneratorPort, OcrPort, ParserPort, WatcherPort } from '@petrify/core';
import { ExcalidrawFileGenerator } from '@petrify/generator-excalidraw';
import { MarkdownFileGenerator } from '@petrify/generator-markdown';
import { GoogleVisionOcr } from '@petrify/ocr-google-vision';
import { TesseractOcr } from '@petrify/ocr-tesseract';
import { ChokidarWatcher } from '@petrify/watcher-chokidar';
import { DropHandler } from './drop-handler.js';
import { FrontmatterConversionState } from './frontmatter-conversion-state.js';
import { createLogger } from './logger.js';
import { createParserMap, ParserId } from './parser-registry.js';
import { DEFAULT_SETTINGS, type OutputFormat, type PetrifySettings } from './settings.js';
import { PetrifySettingsTab } from './settings-tab.js';
import { createFrontmatter, parseFrontmatter } from './utils/frontmatter.js';
import { saveGeneratorOutput } from './utils/save-output.js';

interface FileSystemAdapter extends DataAdapter {
  getBasePath(): string;
}

function createGenerator(format: OutputFormat): FileGeneratorPort {
  switch (format) {
    case 'markdown':
      return new MarkdownFileGenerator();
    case 'excalidraw':
    default:
      return new ExcalidrawFileGenerator();
  }
}

export default class PetrifyPlugin extends Plugin {
  settings!: PetrifySettings;
  private watchers: WatcherPort[] = [];
  private pipeline!: ConversionPipeline;
  private ocr: OcrPort | null = null;
  private generator!: FileGeneratorPort;
  private parserMap!: Map<string, ParserPort>;
  private dropHandler!: DropHandler;
  private isSyncing = false;
  private ribbonIconEl: HTMLElement | null = null;
  private readonly watcherLog = createLogger('Watcher');
  private readonly convertLog = createLogger('Convert');
  private readonly syncLog = createLogger('Sync');

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

    this.dropHandler = new DropHandler(this.app, this.pipeline, this.parserMap);
    this.registerDomEvent(document, 'drop', this.dropHandler.handleDrop);

    await this.startWatchers();
  }

  async onunload(): Promise<void> {
    await Promise.all(this.watchers.map((w) => w.stop()));
    if (this.ocr && 'terminate' in this.ocr) {
      await (this.ocr as TesseractOcr).terminate();
    }
  }

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

    const tesseract = new TesseractOcr({ lang: 'kor+eng', workerPath, corePath });
    await tesseract.initialize();
    this.ocr = tesseract;
  }

  private initializePipeline(): void {
    const adapter = this.app.vault.adapter as FileSystemAdapter;
    const vaultPath = adapter.getBasePath();

    const conversionState = new FrontmatterConversionState(async (id: string) => {
      const outputPath = this.getOutputPathForId(id);
      const fullPath = path.join(vaultPath, outputPath);
      return fs.readFile(fullPath, 'utf-8');
    });

    this.parserMap = createParserMap();
    this.generator = createGenerator(this.settings.outputFormat);

    const extensionMap = new Map<string, ParserPort>();
    for (const [, parser] of this.parserMap) {
      for (const ext of parser.extensions) {
        extensionMap.set(ext.toLowerCase(), parser);
      }
    }

    this.pipeline = new ConversionPipeline(
      extensionMap,
      this.generator,
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
        this.watcherLog.info(`File detected: ${event.name}`);

        try {
          const converted = await this.processFile(event, mapping.outputDir);

          if (converted) {
            this.convertLog.notify(`Converted: ${event.name}`);
          }
        } catch (error) {
          this.convertLog.error(`Conversion failed: ${event.name}`, error);
          this.convertLog.notify(`Conversion failed: ${event.name}`);
        }
      });

      watcher.onFileDelete(async (event) => {
        if (!this.settings.deleteConvertedOnSourceDelete) return;

        const outputPath = this.getOutputPath(event.name, mapping.outputDir);
        await this.handleDeletedSource(outputPath);
      });

      watcher.onError((error) => {
        this.watcherLog.error(`Watch error: ${error.message}`, error);
        this.watcherLog.notify(`Watch error: ${error.message}`);
      });

      await watcher.start();
      this.watchers.push(watcher);
    }
  }

  private async processFile(event: FileChangeEvent, outputDir: string): Promise<boolean> {
    const result = await this.pipeline.handleFileChange(event);
    if (!result) return false;

    const frontmatter = createFrontmatter({ source: event.id, mtime: event.mtime });
    const baseName = event.name.replace(/\.[^/.]+$/, '');
    const outputPath = await saveGeneratorOutput(this.app, result, {
      outputDir,
      outputName: baseName,
      frontmatter,
    });
    this.convertLog.info(`Converted: ${event.name} -> ${outputPath}`);
    return true;
  }

  private async handleDeletedSource(outputPath: string): Promise<void> {
    if (!(await this.app.vault.adapter.exists(outputPath))) return;

    const content = await this.app.vault.adapter.read(outputPath);
    const frontmatter = parseFrontmatter(content);

    if (frontmatter?.keep) {
      this.convertLog.info(`Kept (protected): ${outputPath}`);
      return;
    }

    const file = this.app.vault.getAbstractFileByPath(outputPath);
    if (file) {
      await this.app.vault.trash(file, true);
      this.convertLog.info(`Deleted: ${outputPath}`);
    }
  }

  private getOutputPathForId(id: string): string {
    const mapping = this.settings.watchMappings.find((m) => id.startsWith(m.watchDir));
    if (!mapping) return '';
    const fileName = path.basename(id, path.extname(id));
    return path.join(mapping.outputDir, `${fileName}${this.generator.extension}`);
  }

  private getOutputPath(name: string, outputDir: string): string {
    const fileName = path.basename(name, path.extname(name));
    return path.join(outputDir, `${fileName}${this.generator.extension}`);
  }

  private async restart(): Promise<void> {
    await Promise.all(this.watchers.map((w) => w.stop()));
    this.watchers = [];
    this.initializePipeline();
    await this.startWatchers();
  }

  private async syncAll(): Promise<void> {
    if (this.isSyncing) {
      this.syncLog.info('Sync already in progress');
      this.syncLog.notify('Sync already in progress');
      return;
    }

    this.isSyncing = true;
    this.syncLog.info('Sync started');
    if (this.ribbonIconEl) {
      setIcon(this.ribbonIconEl, 'loader');
    }

    let synced = 0;
    let failed = 0;
    let deleted = 0;

    try {
      for (const mapping of this.settings.watchMappings) {
        if (!mapping.enabled) continue;
        if (!mapping.watchDir || !mapping.outputDir) continue;

        const parserForMapping = this.parserMap.get(mapping.parserId);
        if (!parserForMapping) {
          this.syncLog.error(`Unknown parser: ${mapping.parserId}`);
          failed++;
          continue;
        }
        const supportedExts = parserForMapping.extensions.map(e => e.toLowerCase());

        let entries: string[];
        try {
          entries = await fs.readdir(mapping.watchDir);
        } catch {
          this.syncLog.error(`Directory unreadable: ${mapping.watchDir}`);
          failed++;
          continue;
        }

        for (const entry of entries) {
          const ext = path.extname(entry).toLowerCase();
          if (!supportedExts.includes(ext)) continue;

          const filePath = path.join(mapping.watchDir, entry);
          let stat: { mtimeMs: number };
          try {
            stat = await fs.stat(filePath);
          } catch {
            this.syncLog.error(`File stat failed: ${entry}`);
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
          } catch (error) {
            this.convertLog.error(`Conversion failed: ${entry}`, error);
            failed++;
          }
        }

        if (this.settings.deleteConvertedOnSourceDelete) {
          const adapter = this.app.vault.adapter as FileSystemAdapter;
          const vaultPath = adapter.getBasePath();

          let outputFiles: string[];
          try {
            outputFiles = await fs.readdir(path.join(vaultPath, mapping.outputDir));
          } catch {
            continue;
          }

          for (const outputFile of outputFiles) {
            if (!outputFile.endsWith(this.generator.extension)) continue;

            const outputPath = path.join(mapping.outputDir, outputFile);
            const fullOutputPath = path.join(vaultPath, outputPath);

            let content: string;
            try {
              content = await fs.readFile(fullOutputPath, 'utf-8');
            } catch {
              continue;
            }

            const frontmatter = parseFrontmatter(content);
            if (!frontmatter?.source) continue;
            if (frontmatter.keep) continue;

            try {
              await fs.access(frontmatter.source);
            } catch {
              const file = this.app.vault.getAbstractFileByPath(outputPath);
              if (file) {
                await this.app.vault.trash(file, true);
                this.convertLog.info(`Cleaned orphan: ${outputPath}`);
                deleted++;

                const baseName = outputFile.replace(this.generator.extension, '');
                const assetsDir = path.join(mapping.outputDir, 'assets', baseName);
                const assetsFullPath = path.join(vaultPath, assetsDir);
                try {
                  await fs.rm(assetsFullPath, { recursive: true });
                  this.convertLog.info(`Cleaned orphan assets: ${assetsDir}`);
                } catch {
                  // ignore if assets folder doesn't exist
                }
              }
            }
          }
        }
      }
    } finally {
      this.isSyncing = false;
      if (this.ribbonIconEl) {
        setIcon(this.ribbonIconEl, 'refresh-cw');
      }
    }

    const summary = `Sync complete: ${synced} converted, ${deleted} deleted, ${failed} failed`;
    this.syncLog.info(summary);
    this.syncLog.notify(summary);
  }

  private async loadSettings(): Promise<void> {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
    this.settings.watchMappings = this.settings.watchMappings.map((m) => ({
      ...m,
      enabled: m.enabled ?? true,
      parserId: m.parserId ?? ParserId.Viwoods,
    }));
  }

  private async saveSettings(): Promise<void> {
    await this.saveData(this.settings);
  }
}
