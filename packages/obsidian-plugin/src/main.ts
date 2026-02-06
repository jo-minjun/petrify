import * as fs from 'fs/promises';
import * as path from 'path';
import { Plugin, setIcon } from 'obsidian';
import type { DataAdapter } from 'obsidian';
import { PetrifyService, ConversionError } from '@petrify/core';
import type { FileChangeEvent, FileGeneratorPort, OcrPort, ParserPort, WatcherPort } from '@petrify/core';
import { ExcalidrawFileGenerator } from '@petrify/generator-excalidraw';
import { MarkdownFileGenerator } from '@petrify/generator-markdown';
import { GoogleVisionOcr } from '@petrify/ocr-google-vision';
import { TesseractOcr } from '@petrify/ocr-tesseract';
import { ChokidarWatcher } from '@petrify/watcher-chokidar';
import { DropHandler } from './drop-handler.js';
import { FrontmatterMetadataAdapter } from './frontmatter-metadata-adapter.js';
import { createLogger } from './logger.js';
import { ObsidianFileSystemAdapter } from './obsidian-file-system-adapter.js';
import { createParserMap, ParserId } from './parser-registry.js';
import { DEFAULT_SETTINGS, type OutputFormat, type PetrifySettings } from './settings.js';
import { PetrifySettingsTab } from './settings-tab.js';
import { SyncOrchestrator } from './sync-orchestrator.js';
import type { SyncFileSystem, VaultOperations } from './sync-orchestrator.js';

interface FileSystemAdapter extends DataAdapter {
  getBasePath(): string;
}

function formatConversionError(fileName: string, error: unknown): string {
  if (error instanceof ConversionError) {
    switch (error.phase) {
      case 'parse': return `Parse failed: ${fileName}`;
      case 'ocr': return `OCR failed: ${fileName}`;
      case 'generate': return `Generate failed: ${fileName}`;
      case 'save': return `Save failed: ${fileName}`;
    }
  }
  return `Conversion failed: ${fileName}`;
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
  private petrifyService!: PetrifyService;
  private metadataAdapter!: FrontmatterMetadataAdapter;
  private ocr: OcrPort | null = null;
  private generator!: FileGeneratorPort;
  private parserMap!: Map<string, ParserPort>;
  private dropHandler!: DropHandler;
  private syncOrchestrator!: SyncOrchestrator;
  private isSyncing = false;
  private ribbonIconEl: HTMLElement | null = null;
  private readonly watcherLog = createLogger('Watcher');
  private readonly convertLog = createLogger('Convert');
  private readonly syncLog = createLogger('Sync');

  async onload(): Promise<void> {
    await this.loadSettings();
    await this.initializeOcr();
    this.initializeService();

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

    this.dropHandler = new DropHandler(this.app, this.petrifyService, this.parserMap);
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

  private initializeService(): void {
    const adapter = this.app.vault.adapter as FileSystemAdapter;
    const vaultPath = adapter.getBasePath();

    this.metadataAdapter = new FrontmatterMetadataAdapter(async (id: string) => {
      const outputPath = this.getOutputPathForId(id);
      const fullPath = path.join(vaultPath, outputPath);
      return fs.readFile(fullPath, 'utf-8');
    });

    const fileSystemAdapter = new ObsidianFileSystemAdapter(this.app);

    this.parserMap = createParserMap();
    this.generator = createGenerator(this.settings.outputFormat);

    const extensionMap = new Map<string, ParserPort>();
    for (const [, parser] of this.parserMap) {
      for (const ext of parser.extensions) {
        extensionMap.set(ext.toLowerCase(), parser);
      }
    }

    this.petrifyService = new PetrifyService(
      extensionMap,
      this.generator,
      this.ocr,
      this.metadataAdapter,
      fileSystemAdapter,
      { confidenceThreshold: this.settings.ocr.confidenceThreshold },
    );

    const syncFs: SyncFileSystem = {
      readdir: (dirPath) => fs.readdir(dirPath),
      stat: (filePath) => fs.stat(filePath),
      readFile: (filePath) => fs.readFile(filePath).then((buf) => buf.buffer as ArrayBuffer),
      access: (filePath) => fs.access(filePath),
      rm: (filePath, options) => fs.rm(filePath, options),
    };

    const vaultOps: VaultOperations = {
      getBasePath: () => (this.app.vault.adapter as FileSystemAdapter).getBasePath(),
      trash: async (outputPath) => {
        const file = this.app.vault.getAbstractFileByPath(outputPath);
        if (file) {
          await this.app.vault.trash(file, true);
        }
      },
    };

    this.syncOrchestrator = new SyncOrchestrator(
      this.petrifyService,
      this.metadataAdapter,
      this.parserMap,
      this.generator,
      syncFs,
      vaultOps,
      this.syncLog,
      this.convertLog,
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
          const message = formatConversionError(event.name, error);
          this.convertLog.error(message, error);
          this.convertLog.notify(message);
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
    const outputPath = await this.petrifyService.handleFileChange(event, outputDir);
    if (!outputPath) return false;

    this.convertLog.info(`Converted: ${event.name} -> ${outputPath}`);
    return true;
  }

  private async handleDeletedSource(outputPath: string): Promise<void> {
    if (!(await this.app.vault.adapter.exists(outputPath))) return;

    const canDelete = await this.petrifyService.handleFileDelete(outputPath);
    if (!canDelete) {
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
    this.initializeService();
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

    try {
      const result = await this.syncOrchestrator.syncAll(
        this.settings.watchMappings,
        this.settings.deleteConvertedOnSourceDelete,
      );

      const summary = `Sync complete: ${result.synced} converted, ${result.deleted} deleted, ${result.failed} failed`;
      this.syncLog.info(summary);
      this.syncLog.notify(summary);
    } finally {
      this.isSyncing = false;
      if (this.ribbonIconEl) {
        setIcon(this.ribbonIconEl, 'refresh-cw');
      }
    }
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
