import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import type {
  ConversionResult,
  FileChangeEvent,
  FileGeneratorPort,
  OcrPort,
  ParserPort,
  WatcherPort,
} from '@petrify/core';
import { PetrifyService } from '@petrify/core';
import { ExcalidrawFileGenerator } from '@petrify/generator-excalidraw';
import { MarkdownFileGenerator } from '@petrify/generator-markdown';
import { GoogleVisionOcr } from '@petrify/ocr-google-vision';
import { ChokidarWatcher } from '@petrify/watcher-chokidar';
import type { OAuth2Client, PageTokenStore, TokenStore } from '@petrify/watcher-google-drive';
import {
  GoogleDriveAuth,
  GoogleDriveClient,
  GoogleDriveWatcher,
} from '@petrify/watcher-google-drive';
import type { DataAdapter } from 'obsidian';
import { Notice, Plugin, setIcon, TFile } from 'obsidian';
import { saveConversionResult as saveResult } from './conversion-saver.js';
import { DropHandler } from './drop-handler.js';
import { formatConversionError } from './format-conversion-error.js';
import { FrontmatterMetadataAdapter } from './frontmatter-metadata-adapter.js';
import { createLogger } from './logger.js';
import { ObsidianFileSystemAdapter } from './obsidian-file-system-adapter.js';
import { createParserMap } from './parser-registry.js';
import { processFile as processFileImpl } from './process-file.js';
import { DEFAULT_SETTINGS, type OutputFormat, type PetrifySettings } from './settings.js';
import { PetrifySettingsTab } from './settings-tab.js';
import type {
  ReadDirEntry,
  SyncFileSystem,
  SyncMapping,
  VaultOperations,
} from './sync-orchestrator.js';
import { SyncOrchestrator } from './sync-orchestrator.js';
import { parseFrontmatter, updateKeepInContent } from './utils/frontmatter.js';

interface FileSystemAdapter extends DataAdapter {
  getBasePath(): string;
}

function createGenerator(format: OutputFormat): FileGeneratorPort {
  switch (format) {
    case 'markdown':
      return new MarkdownFileGenerator();
    default:
      return new ExcalidrawFileGenerator();
  }
}

export default class PetrifyPlugin extends Plugin {
  settings!: PetrifySettings;
  private watchers: WatcherPort[] = [];
  private petrifyService!: PetrifyService;
  private metadataAdapter!: FrontmatterMetadataAdapter;
  private fsAdapter!: ObsidianFileSystemAdapter;
  private ocr: OcrPort | null = null;
  private generator!: FileGeneratorPort;
  private parserMap!: Map<string, ParserPort>;
  private dropHandler!: DropHandler;
  private syncOrchestrator!: SyncOrchestrator;
  private isSyncing = false;
  private ribbonIconEl: HTMLElement | null = null;
  private googleDriveAuth: GoogleDriveAuth | null = null;
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

    this.addCommand({
      id: 'toggle-keep-protection',
      name: 'Toggle keep protection',
      checkCallback: (checking: boolean) => {
        const file = this.app.workspace.getActiveFile();
        if (!file || !this.isPetrifyFile(file)) return false;
        if (!checking) {
          this.toggleKeep(file);
        }
        return true;
      },
    });

    this.registerEvent(
      this.app.workspace.on('file-menu', (menu, file) => {
        if (!(file instanceof TFile) || !this.isPetrifyFile(file)) return;

        menu.addItem((item) => {
          item
            .setTitle('Petrify: Toggle keep protection')
            .setIcon('shield')
            .onClick(() => this.toggleKeep(file));
        });
      }),
    );

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
        getGoogleDriveClient: async () => {
          const auth = await this.getGoogleDriveAuthClient();
          if (!auth) return null;
          return new GoogleDriveClient(auth);
        },
      }),
    );

    this.dropHandler = new DropHandler(
      this.app,
      this.petrifyService,
      this.parserMap,
      (result, outputDir, baseName) => this.saveConversionResult(result, outputDir, baseName),
    );
    this.registerDomEvent(document, 'drop', this.dropHandler.handleDrop);

    await this.startWatchers();
  }

  async onunload(): Promise<void> {
    await Promise.all(this.watchers.map((w) => w.stop()));
    await this.ocr?.terminate?.();
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

    // Tesseract (default) — 별도 번들에서 동적 로드
    const adapter = this.app.vault.adapter as FileSystemAdapter;
    const vaultPath = adapter.getBasePath();
    const pluginDir = path.join(vaultPath, '.obsidian', 'plugins', 'petrify');

    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { TesseractOcr } = require(path.join(pluginDir, 'tesseract-ocr.cjs')) as {
      TesseractOcr: typeof import('@petrify/ocr-tesseract').TesseractOcr;
    };

    const workerPath = `file://${path.join(pluginDir, 'worker.min.js')}`;

    const tesseract = new TesseractOcr({ lang: 'kor+eng', workerPath });
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

    this.fsAdapter = new ObsidianFileSystemAdapter(this.app);

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
      { confidenceThreshold: this.settings.ocr.confidenceThreshold },
    );

    const syncFs: SyncFileSystem = {
      readdir: async (dirPath): Promise<ReadDirEntry[]> => {
        const names = await fs.readdir(dirPath);
        return names.map((name) => ({ name }));
      },
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
      (result, outputDir, baseName) => this.saveConversionResult(result, outputDir, baseName),
      this.syncLog,
      this.convertLog,
    );
  }

  private async startWatchers(): Promise<void> {
    if (this.settings.localWatch.enabled) {
      for (const mapping of this.settings.localWatch.mappings) {
        if (!mapping.enabled || !mapping.watchDir || !mapping.outputDir) continue;
        const watcher = new ChokidarWatcher(mapping.watchDir);
        this.attachWatcherHandlers(watcher, mapping.outputDir);
        await watcher.start();
        this.watchers.push(watcher);
      }
    }

    if (this.settings.googleDrive.enabled && this.settings.googleDrive.autoPolling) {
      const authClient = await this.getGoogleDriveAuthClient();
      if (!authClient) {
        this.watcherLog.error('Google Drive auth not configured or failed');
        return;
      }

      for (const mapping of this.settings.googleDrive.mappings) {
        if (!mapping.enabled || !mapping.folderId || !mapping.outputDir) continue;
        const watcher = new GoogleDriveWatcher({
          folderId: mapping.folderId,
          pollIntervalMs: this.settings.googleDrive.pollIntervalMinutes * 60000,
          auth: authClient,
          pageTokenStore: this.createPageTokenStore(mapping.folderId),
        });
        this.attachWatcherHandlers(watcher, mapping.outputDir);
        await watcher.start();
        this.watchers.push(watcher);
      }
    }
  }

  private attachWatcherHandlers(watcher: WatcherPort, outputDir: string): void {
    watcher.onFileChange(async (event) => {
      this.watcherLog.info(`File detected: ${event.name}`);
      try {
        const converted = await this.processFile(event, outputDir);
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
      if (!this.settings.autoSync) return;
      const outputPath = this.getOutputPath(event.name, outputDir);
      await this.handleDeletedSource(outputPath);
    });

    watcher.onError((error) => {
      this.watcherLog.error(`Watch error: ${error.message}`, error);
      this.watcherLog.notify(`Watch error: ${error.message}`);
    });
  }

  private async processFile(event: FileChangeEvent, outputDir: string): Promise<boolean> {
    return processFileImpl(
      event,
      outputDir,
      this.petrifyService,
      (result, dir, baseName) => this.saveConversionResult(result, dir, baseName),
      this.convertLog,
    );
  }

  private async saveConversionResult(
    result: ConversionResult,
    outputDir: string,
    baseName: string,
  ): Promise<string> {
    return saveResult(
      result,
      outputDir,
      baseName,
      this.generator.extension,
      this.fsAdapter,
      this.metadataAdapter,
    );
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

  private async toggleKeep(file: TFile): Promise<void> {
    const content = await this.app.vault.read(file);
    const meta = parseFrontmatter(content);
    if (!meta) {
      new Notice('Petrify: Not a petrify-generated file');
      return;
    }

    const newKeep = !meta.keep;
    const updated = updateKeepInContent(content, newKeep);
    await this.app.vault.modify(file, updated);

    const status = newKeep ? 'protected' : 'unprotected';
    new Notice(`Petrify: File ${status}`);
  }

  private isPetrifyFile(file: TFile): boolean {
    return file.path.endsWith(this.generator.extension);
  }

  private getOutputPathForId(id: string): string {
    const localMapping = this.settings.localWatch.mappings.find((m) => id.startsWith(m.watchDir));
    if (localMapping) {
      const fileName = path.basename(id, path.extname(id));
      return path.join(localMapping.outputDir, `${fileName}${this.generator.extension}`);
    }

    const driveMapping = this.settings.googleDrive.mappings.find((m) => id.includes(m.folderId));
    if (driveMapping) {
      const fileName = path.basename(id, path.extname(id));
      return path.join(driveMapping.outputDir, `${fileName}${this.generator.extension}`);
    }

    return '';
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
      const syncMappings = this.buildSyncMappings();
      const result = await this.syncOrchestrator.syncAll(syncMappings, this.settings.autoSync);

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

  private buildSyncMappings(): SyncMapping[] {
    const mappings: SyncMapping[] = [];

    if (this.settings.localWatch.enabled) {
      for (const m of this.settings.localWatch.mappings) {
        mappings.push({
          watchDir: m.watchDir,
          outputDir: m.outputDir,
          enabled: m.enabled,
          parserId: m.parserId,
        });
      }
    }

    if (this.settings.googleDrive.enabled) {
      for (const m of this.settings.googleDrive.mappings) {
        mappings.push({
          watchDir: m.folderId,
          outputDir: m.outputDir,
          enabled: m.enabled,
          parserId: m.parserId,
        });
      }
    }

    return mappings;
  }

  private async loadSettings(): Promise<void> {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }

  private async saveSettings(): Promise<void> {
    await this.saveData(this.settings);
  }

  private async getGoogleDriveAuthClient(): Promise<OAuth2Client | null> {
    const { clientId, clientSecret } = this.settings.googleDrive;
    if (!clientId || !clientSecret) return null;

    if (!this.googleDriveAuth) {
      this.googleDriveAuth = new GoogleDriveAuth({
        clientId,
        clientSecret,
        tokenStore: this.createTokenStore(),
      });
    }

    return this.googleDriveAuth.restoreSession();
  }

  private createTokenStore(): TokenStore {
    return {
      loadTokens: async () => {
        const data = await this.loadData();
        return data?.googleDriveTokens ?? null;
      },
      saveTokens: async (tokens) => {
        const data = (await this.loadData()) ?? {};
        data.googleDriveTokens = tokens;
        await this.saveData(data);
      },
      clearTokens: async () => {
        const data = (await this.loadData()) ?? {};
        delete data.googleDriveTokens;
        await this.saveData(data);
      },
    };
  }

  private createPageTokenStore(folderId: string): PageTokenStore {
    const key = `pageToken_${folderId}`;
    return {
      loadPageToken: async () => {
        const data = await this.loadData();
        return data?.[key] ?? null;
      },
      savePageToken: async (token) => {
        const data = (await this.loadData()) ?? {};
        data[key] = token;
        await this.saveData(data);
      },
    };
  }
}
