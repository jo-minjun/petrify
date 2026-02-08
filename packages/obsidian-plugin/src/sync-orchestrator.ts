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

export enum SyncSource {
  Local = 'local',
  GoogleDrive = 'google-drive',
}

export interface SyncMapping {
  readonly watchDir: string;
  readonly outputDir: string;
  readonly enabled: boolean;
  readonly parserId: string;
  readonly source: SyncSource;
}

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
    watchMappings: SyncMapping[],
    syncFsForMapping?: (mapping: SyncMapping) => SyncFileSystem | null,
  ): Promise<SyncResult> {
    let synced = 0;
    let failed = 0;
    let deleted = 0;

    for (const mapping of watchMappings) {
      if (!mapping.enabled) continue;
      if (!mapping.watchDir) continue;

      const mappingFs = syncFsForMapping?.(mapping) ?? this.fs;

      const parserForMapping = this.parserMap.get(mapping.parserId);
      if (!parserForMapping) {
        this.syncLog.error(`Unknown parser: ${mapping.parserId}`);
        failed++;
        continue;
      }

      const fileResult = await this.syncFiles(mapping, mappingFs, parserForMapping);
      synced += fileResult.synced;
      failed += fileResult.failed;

      deleted += await this.cleanOrphans(mapping, mappingFs);
    }

    return { synced, failed, deleted };
  }

  private async syncFiles(
    mapping: SyncMapping,
    mappingFs: SyncFileSystem,
    parser: ParserPort,
  ): Promise<{ synced: number; failed: number }> {
    let synced = 0;
    let failed = 0;

    const supportedExts = parser.extensions.map((e) => e.toLowerCase());

    let entries: ReadDirEntry[];
    try {
      entries = await mappingFs.readdir(mapping.watchDir);
    } catch (error) {
      this.syncLog.error(`Directory unreadable: ${mapping.watchDir}`, error);
      return { synced, failed: 1 };
    }

    for (const entry of entries) {
      const ext = path.extname(entry.name).toLowerCase();
      if (!supportedExts.includes(ext)) continue;

      const fileRef = entry.fileRef ?? path.join(mapping.watchDir, entry.name);
      let stat: { mtimeMs: number };
      try {
        stat = await mappingFs.stat(fileRef);
      } catch (error) {
        this.syncLog.error(`File stat failed: ${entry.name}`, error);
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

    return { synced, failed };
  }

  private async cleanOrphans(mapping: SyncMapping, mappingFs: SyncFileSystem): Promise<number> {
    const vaultPath = this.vault.getBasePath();
    let deleted = 0;

    let outputEntries: ReadDirEntry[];
    try {
      outputEntries = await this.fs.readdir(path.join(vaultPath, mapping.outputDir));
    } catch (error) {
      this.syncLog.error(`Failed to read output directory: ${mapping.outputDir}`, error);
      return 0;
    }

    for (const outputEntry of outputEntries) {
      if (!outputEntry.name.endsWith(this.generator.extension)) continue;

      const safeName = path.basename(outputEntry.name);
      const outputPath = path.join(mapping.outputDir, safeName);
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

        const baseName = safeName.replace(this.generator.extension, '');
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

    return deleted;
  }
}
