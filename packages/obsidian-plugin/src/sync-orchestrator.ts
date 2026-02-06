import * as path from 'node:path';
import type {
  ConversionMetadataPort,
  FileChangeEvent,
  FileGeneratorPort,
  ParserPort,
  PetrifyService,
} from '@petrify/core';
import type { SaveConversionFn } from './drop-handler.js';
import { formatConversionError } from './format-conversion-error.js';
import type { Logger } from './logger.js';
import type { WatchMapping } from './settings.js';

export interface ReadDirEntry {
  readonly name: string;
  /** Opaque reference used by stat/readFile. Defaults to path.join(watchDir, name) when absent. */
  readonly fileRef?: string;
}

export interface SyncFileSystem {
  readdir(dirPath: string): Promise<ReadDirEntry[]>;
  stat(fileRef: string): Promise<{ mtimeMs: number }>;
  readFile(fileRef: string): Promise<ArrayBuffer>;
  access(fileRef: string): Promise<void>;
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
    private readonly saveResult: SaveConversionFn,
    private readonly syncLog: Logger,
    private readonly convertLog: Logger,
  ) {}

  async syncAll(
    watchMappings: WatchMapping[],
    deleteOnSourceDelete: boolean,
    syncFsForMapping?: (mapping: WatchMapping) => SyncFileSystem | null,
  ): Promise<SyncResult> {
    let synced = 0;
    let failed = 0;
    let deleted = 0;

    for (const mapping of watchMappings) {
      if (!mapping.enabled) continue;
      if (!mapping.watchDir || !mapping.outputDir) continue;

      const mappingFs = syncFsForMapping?.(mapping) ?? this.fs;

      const parserForMapping = this.parserMap.get(mapping.parserId);
      if (!parserForMapping) {
        this.syncLog.error(`Unknown parser: ${mapping.parserId}`);
        failed++;
        continue;
      }
      const supportedExts = parserForMapping.extensions.map((e) => e.toLowerCase());

      let entries: ReadDirEntry[];
      try {
        entries = await mappingFs.readdir(mapping.watchDir);
      } catch {
        this.syncLog.error(`Directory unreadable: ${mapping.watchDir}`);
        failed++;
        continue;
      }

      for (const entry of entries) {
        const ext = path.extname(entry.name).toLowerCase();
        if (!supportedExts.includes(ext)) continue;

        const fileRef = entry.fileRef ?? path.join(mapping.watchDir, entry.name);
        let stat: { mtimeMs: number };
        try {
          stat = await mappingFs.stat(fileRef);
        } catch {
          this.syncLog.error(`File stat failed: ${entry.name}`);
          failed++;
          continue;
        }

        const event: FileChangeEvent = {
          id: fileRef,
          name: entry.name,
          extension: ext,
          mtime: stat.mtimeMs,
          readData: () => mappingFs.readFile(fileRef),
        };

        try {
          const result = await this.petrifyService.handleFileChange(event);
          if (result) {
            const baseName = entry.name.replace(/\.[^/.]+$/, '');
            const outputPath = await this.saveResult(result, mapping.outputDir, baseName);
            this.convertLog.info(`Converted: ${entry.name} -> ${outputPath}`);
            synced++;
          }
        } catch (error) {
          const message = formatConversionError(entry.name, error);
          this.convertLog.error(message, error);
          failed++;
        }
      }

      if (deleteOnSourceDelete) {
        const vaultPath = this.vault.getBasePath();

        let outputEntries: ReadDirEntry[];
        try {
          outputEntries = await this.fs.readdir(path.join(vaultPath, mapping.outputDir));
        } catch {
          continue;
        }

        for (const outputEntry of outputEntries) {
          if (!outputEntry.name.endsWith(this.generator.extension)) continue;

          const outputPath = path.join(mapping.outputDir, outputEntry.name);
          const canDelete = await this.petrifyService.handleFileDelete(outputPath);
          if (!canDelete) continue;

          const metadata = await this.metadataAdapter.getMetadata(outputPath);
          if (!metadata?.source) continue;

          try {
            await mappingFs.access(metadata.source);
          } catch {
            await this.vault.trash(outputPath);
            this.convertLog.info(`Cleaned orphan: ${outputPath}`);
            deleted++;

            const baseName = outputEntry.name.replace(this.generator.extension, '');
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
