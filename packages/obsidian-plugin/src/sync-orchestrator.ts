import * as path from 'path';
import type {
  PetrifyService,
  ParserPort,
  FileGeneratorPort,
  ConversionMetadataPort,
  FileChangeEvent,
} from '@petrify/core';
import { formatConversionError } from './format-conversion-error.js';
import type { Logger } from './logger.js';
import type { WatchMapping } from './settings.js';

export interface SyncFileSystem {
  readdir(dirPath: string): Promise<string[]>;
  stat(filePath: string): Promise<{ mtimeMs: number }>;
  readFile(filePath: string): Promise<ArrayBuffer>;
  access(filePath: string): Promise<void>;
  rm(filePath: string, options?: { recursive: boolean }): Promise<void>;
}

export interface VaultOperations {
  trash(outputPath: string): Promise<void>;
  getBasePath(): string;
}

export interface SyncResult {
  synced: number;
  failed: number;
  deleted: number;
}

export class SyncOrchestrator {
  constructor(
    private readonly petrifyService: PetrifyService,
    private readonly metadataAdapter: ConversionMetadataPort,
    private readonly parserMap: Map<string, ParserPort>,
    private readonly generator: FileGeneratorPort,
    private readonly fs: SyncFileSystem,
    private readonly vault: VaultOperations,
    private readonly syncLog: Logger,
    private readonly convertLog: Logger,
  ) {}

  async syncAll(
    watchMappings: WatchMapping[],
    deleteOnSourceDelete: boolean,
  ): Promise<SyncResult> {
    let synced = 0;
    let failed = 0;
    let deleted = 0;

    for (const mapping of watchMappings) {
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
        entries = await this.fs.readdir(mapping.watchDir);
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
          stat = await this.fs.stat(filePath);
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
          readData: () => this.fs.readFile(filePath),
        };

        try {
          const outputPath = await this.petrifyService.handleFileChange(event, mapping.outputDir);
          if (outputPath) {
            this.convertLog.info(`Converted: ${entry} -> ${outputPath}`);
            synced++;
          }
        } catch (error) {
          const message = formatConversionError(entry, error);
          this.convertLog.error(message, error);
          failed++;
        }
      }

      if (deleteOnSourceDelete) {
        const vaultPath = this.vault.getBasePath();

        let outputFiles: string[];
        try {
          outputFiles = await this.fs.readdir(path.join(vaultPath, mapping.outputDir));
        } catch {
          continue;
        }

        for (const outputFile of outputFiles) {
          if (!outputFile.endsWith(this.generator.extension)) continue;

          const outputPath = path.join(mapping.outputDir, outputFile);
          const canDelete = await this.petrifyService.handleFileDelete(outputPath);
          if (!canDelete) continue;

          const metadata = await this.metadataAdapter.getMetadata(outputPath);
          if (!metadata?.source) continue;

          try {
            await this.fs.access(metadata.source);
          } catch {
            await this.vault.trash(outputPath);
            this.convertLog.info(`Cleaned orphan: ${outputPath}`);
            deleted++;

            const baseName = outputFile.replace(this.generator.extension, '');
            const assetsDir = path.join(mapping.outputDir, 'assets', baseName);
            const assetsFullPath = path.join(vaultPath, assetsDir);
            try {
              await this.fs.rm(assetsFullPath, { recursive: true });
              this.convertLog.info(`Cleaned orphan assets: ${assetsDir}`);
            } catch {
              // assets 폴더가 없는 경우 무시
            }
          }
        }
      }
    }

    return { synced, failed, deleted };
  }
}
