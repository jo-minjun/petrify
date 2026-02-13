import type {
  ConversionMetadataPort,
  FileGeneratorPort,
  ParserPort,
  PetrifyService,
} from '@petrify/core';
import { ConversionError } from '@petrify/core';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { SaveConversionFn } from '../src/drop-handler.js';
import type { Logger } from '../src/logger.js';
import type {
  ReadDirEntry,
  SyncFileSystem,
  SyncMapping,
  VaultOperations,
} from '../src/sync-orchestrator.js';
import { SyncOrchestrator, SyncSource } from '../src/sync-orchestrator.js';

/** Wrap filenames as ReadDirEntry[] for readdir mocks */
function entries(...names: string[]): ReadDirEntry[] {
  return names.map((name) => ({ name }));
}

vi.mock('obsidian', () => ({
  Notice: vi.fn(),
  normalizePath: (p: string) => p,
}));

function createMockLogger(): Logger {
  return {
    info: vi.fn(),
    error: vi.fn(),
    notify: vi.fn(),
  };
}

function createMockFs(): {
  [K in keyof SyncFileSystem]: ReturnType<typeof vi.fn>;
} {
  return {
    readdir: vi.fn(),
    stat: vi.fn(),
    readFile: vi.fn(),
    access: vi.fn(),
    rm: vi.fn(),
  };
}

function createMockVault(): {
  [K in keyof VaultOperations]: ReturnType<typeof vi.fn>;
} {
  return {
    trash: vi.fn(),
    getBasePath: vi.fn().mockReturnValue('/vault'),
  };
}

function createMockPetrifyService(): {
  handleFileChange: ReturnType<typeof vi.fn>;
  handleFileDelete: ReturnType<typeof vi.fn>;
} {
  return {
    handleFileChange: vi.fn(),
    handleFileDelete: vi.fn(),
  };
}

function createMockMetadataAdapter(): {
  getMetadata: ReturnType<typeof vi.fn>;
  formatMetadata: ReturnType<typeof vi.fn>;
} {
  return {
    getMetadata: vi.fn(),
    formatMetadata: vi.fn(),
  };
}

function createMockGenerator(): {
  id: string;
  displayName: string;
  extension: string;
  generate: ReturnType<typeof vi.fn>;
} {
  return {
    id: 'excalidraw',
    displayName: 'Excalidraw',
    extension: '.excalidraw.md',
    generate: vi.fn(),
  };
}

function createMockParser(extensions: string[]): ParserPort {
  return {
    extensions,
    parse: vi.fn(),
  };
}

function createDefaultMapping(
  overrides?: Partial<Omit<SyncMapping, 'source'>> & { source?: SyncMapping['source'] },
): SyncMapping {
  return {
    watchDir: '/watch',
    outputDir: 'output',
    enabled: true,
    parserId: 'viwoods',
    source: SyncSource.Local,
    ...overrides,
  };
}

describe('SyncOrchestrator', () => {
  let orchestrator: SyncOrchestrator;
  let mockService: ReturnType<typeof createMockPetrifyService>;
  let mockMetadata: ReturnType<typeof createMockMetadataAdapter>;
  let mockFs: ReturnType<typeof createMockFs>;
  let mockVault: ReturnType<typeof createMockVault>;
  let mockGenerator: ReturnType<typeof createMockGenerator>;
  let saveResult: ReturnType<typeof vi.fn>;
  let syncLog: Logger;
  let convertLog: Logger;
  let parserMap: Map<string, ParserPort>;

  beforeEach(() => {
    mockService = createMockPetrifyService();
    mockMetadata = createMockMetadataAdapter();
    mockFs = createMockFs();
    mockVault = createMockVault();
    mockGenerator = createMockGenerator();
    saveResult = vi.fn().mockResolvedValue('output/file.excalidraw.md');
    syncLog = createMockLogger();
    convertLog = createMockLogger();

    const parser = createMockParser(['.note']);
    parserMap = new Map([['viwoods', parser]]);

    orchestrator = new SyncOrchestrator(
      mockService as unknown as PetrifyService,
      mockMetadata as ConversionMetadataPort,
      parserMap,
      mockGenerator as FileGeneratorPort,
      mockFs,
      mockVault,
      saveResult as SaveConversionFn,
      syncLog,
      convertLog,
    );
  });

  it('successful sync: finds file and converts successfully', async () => {
    const parser = parserMap.get('viwoods');
    expect(parser).toBeDefined();

    mockFs.readdir.mockResolvedValue(entries('file.note'));
    mockFs.stat.mockResolvedValue({ mtimeMs: 1000 });
    mockFs.readFile.mockResolvedValue(new ArrayBuffer(8));
    mockService.handleFileChange.mockResolvedValue({
      content: 'test',
      assets: new Map(),
      metadata: { source: '/watch/file.note', mtime: 1000 },
    });

    const result = await orchestrator.syncAll([createDefaultMapping()]);

    expect(result).toEqual({ synced: 1, failed: 0, deleted: 0 });
    expect(mockService.handleFileChange).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'file.note' }),
      parser,
    );
    expect(convertLog.info).toHaveBeenCalledWith(expect.stringContaining('Converted: file.note'));
  });

  it('uses parser from parserId when multiple parsers share extension', async () => {
    const viwoodsParser = createMockParser(['.note']);
    const supernoteParser = createMockParser(['.note']);
    const multiParserMap = new Map<string, ParserPort>([
      ['viwoods', viwoodsParser],
      ['supernote-x', supernoteParser],
    ]);

    orchestrator = new SyncOrchestrator(
      mockService as unknown as PetrifyService,
      mockMetadata as ConversionMetadataPort,
      multiParserMap,
      mockGenerator as FileGeneratorPort,
      mockFs,
      mockVault,
      saveResult as SaveConversionFn,
      syncLog,
      convertLog,
    );

    mockFs.readdir.mockResolvedValue(entries('file.note'));
    mockFs.stat.mockResolvedValue({ mtimeMs: 1000 });
    mockFs.readFile.mockResolvedValue(new ArrayBuffer(8));
    mockService.handleFileChange.mockResolvedValue({
      content: 'test',
      assets: new Map(),
      metadata: { source: '/watch/file.note', mtime: 1000 },
    });

    const result = await orchestrator.syncAll([createDefaultMapping({ parserId: 'supernote-x' })]);

    expect(result).toEqual({ synced: 1, failed: 0, deleted: 0 });
    expect(mockService.handleFileChange).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'file.note' }),
      supernoteParser,
    );
  });

  it('increments failed when directory read fails', async () => {
    mockFs.readdir.mockRejectedValue(new Error('ENOENT'));

    const result = await orchestrator.syncAll([createDefaultMapping()]);

    expect(result).toEqual({ synced: 0, failed: 1, deleted: 0 });
    expect(syncLog.error).toHaveBeenCalledWith('Directory unreadable: /watch', expect.any(Error));
  });

  it('increments failed when file stat fails', async () => {
    mockFs.readdir.mockResolvedValue(entries('file.note'));
    mockFs.stat.mockRejectedValue(new Error('EACCES'));

    const result = await orchestrator.syncAll([createDefaultMapping()]);

    expect(result).toEqual({ synced: 0, failed: 1, deleted: 0 });
    expect(syncLog.error).toHaveBeenCalledWith('File stat failed: file.note', expect.any(Error));
  });

  it('increments failed with ConversionError message when conversion fails', async () => {
    mockFs.readdir.mockResolvedValue(entries('file.note'));
    mockFs.stat.mockResolvedValue({ mtimeMs: 1000 });
    mockFs.readFile.mockResolvedValue(new ArrayBuffer(8));
    mockService.handleFileChange.mockRejectedValue(
      new ConversionError('parse', new Error('invalid format')),
    );

    const result = await orchestrator.syncAll([createDefaultMapping()]);

    expect(result).toEqual({ synced: 0, failed: 1, deleted: 0 });
    expect(convertLog.error).toHaveBeenCalledWith(
      'Parse failed: file.note',
      expect.any(ConversionError),
    );
  });

  it('skips already converted files (handleFileChange returns null)', async () => {
    mockFs.readdir.mockResolvedValue(entries('file.note'));
    mockFs.stat.mockResolvedValue({ mtimeMs: 1000 });
    mockFs.readFile.mockResolvedValue(new ArrayBuffer(8));
    mockService.handleFileChange.mockResolvedValue(null);

    const result = await orchestrator.syncAll([createDefaultMapping()]);

    expect(result).toEqual({ synced: 0, failed: 0, deleted: 0 });
  });

  it('orphan cleanup: deletes converted files without source', async () => {
    mockFs.readdir
      .mockResolvedValueOnce(entries())
      .mockResolvedValueOnce(entries('file.excalidraw.md'));
    mockService.handleFileDelete.mockResolvedValue(true);
    mockMetadata.getMetadata.mockResolvedValue({
      source: '/watch/file.note',
      mtime: 1000,
    });
    mockFs.access.mockRejectedValue(new Error('ENOENT'));
    mockVault.trash.mockResolvedValue(undefined);
    mockFs.rm.mockResolvedValue(undefined);

    const result = await orchestrator.syncAll([createDefaultMapping()]);

    expect(result).toEqual({ synced: 0, failed: 0, deleted: 1 });
    expect(mockVault.trash).toHaveBeenCalledWith('output/file.excalidraw.md');
    expect(mockFs.rm).toHaveBeenCalledWith('/vault/output/assets/file', { recursive: true });
  });

  it('orphan cleanup: does not delete files with keep=true', async () => {
    mockFs.readdir
      .mockResolvedValueOnce(entries())
      .mockResolvedValueOnce(entries('file.excalidraw.md'));
    mockService.handleFileDelete.mockResolvedValue(false);

    const result = await orchestrator.syncAll([createDefaultMapping()]);

    expect(result).toEqual({ synced: 0, failed: 0, deleted: 0 });
    expect(mockVault.trash).not.toHaveBeenCalled();
  });

  it('ignores files with unsupported extensions', async () => {
    mockFs.readdir.mockResolvedValue(entries('file.txt', 'readme.md'));

    const result = await orchestrator.syncAll([createDefaultMapping()]);

    expect(result).toEqual({ synced: 0, failed: 0, deleted: 0 });
    expect(mockService.handleFileChange).not.toHaveBeenCalled();
  });

  it('skips disabled mappings', async () => {
    const mapping = createDefaultMapping({ enabled: false });

    const result = await orchestrator.syncAll([mapping]);

    expect(result).toEqual({ synced: 0, failed: 0, deleted: 0 });
    expect(mockFs.readdir).not.toHaveBeenCalled();
  });

  it('skips when watchDir is empty string', async () => {
    const mapping = createDefaultMapping({ watchDir: '' });

    const result = await orchestrator.syncAll([mapping]);

    expect(result).toEqual({ synced: 0, failed: 0, deleted: 0 });
    expect(mockFs.readdir).not.toHaveBeenCalled();
  });

  it('works correctly when outputDir is empty string (vault root)', async () => {
    mockFs.readdir.mockResolvedValue(entries('file.note'));
    mockFs.stat.mockResolvedValue({ mtimeMs: 1000 });
    mockFs.readFile.mockResolvedValue(new ArrayBuffer(8));
    mockService.handleFileChange.mockResolvedValue({
      content: 'test',
      assets: new Map(),
      metadata: { source: '/watch/file.note', mtime: 1000 },
    });

    const mapping = createDefaultMapping({ outputDir: '' });
    const result = await orchestrator.syncAll([mapping]);

    expect(result).toEqual({ synced: 1, failed: 0, deleted: 0 });
    expect(mockService.handleFileChange).toHaveBeenCalledOnce();
  });

  it('increments failed when parserId is unknown', async () => {
    const mapping = createDefaultMapping({ parserId: 'unknown' });

    const result = await orchestrator.syncAll([mapping]);

    expect(result).toEqual({ synced: 0, failed: 1, deleted: 0 });
    expect(syncLog.error).toHaveBeenCalledWith('Unknown parser: unknown');
  });

  it('aggregates results from multiple mappings', async () => {
    const mapping1 = createDefaultMapping({ watchDir: '/watch1' });
    const mapping2 = createDefaultMapping({ watchDir: '/watch2' });

    mockFs.readdir.mockResolvedValue(entries('file.note'));
    mockFs.stat.mockResolvedValue({ mtimeMs: 1000 });
    mockFs.readFile.mockResolvedValue(new ArrayBuffer(8));
    mockService.handleFileChange.mockResolvedValue({
      content: 'test',
      assets: new Map(),
      metadata: { source: '/watch/file.note', mtime: 1000 },
    });

    const result = await orchestrator.syncAll([mapping1, mapping2]);

    expect(result).toEqual({ synced: 2, failed: 0, deleted: 0 });
  });

  it('preserves deleted count even when orphan assets deletion fails', async () => {
    mockFs.readdir
      .mockResolvedValueOnce(entries())
      .mockResolvedValueOnce(entries('file.excalidraw.md'));
    mockService.handleFileDelete.mockResolvedValue(true);
    mockMetadata.getMetadata.mockResolvedValue({
      source: '/watch/file.note',
      mtime: 1000,
    });
    mockFs.access.mockRejectedValue(new Error('ENOENT'));
    mockVault.trash.mockResolvedValue(undefined);
    mockFs.rm.mockRejectedValue(new Error('ENOENT'));

    const result = await orchestrator.syncAll([createDefaultMapping()]);

    expect(result).toEqual({ synced: 0, failed: 0, deleted: 1 });
  });

  it('orphan cleanup: continues when output directory read fails', async () => {
    mockFs.readdir.mockResolvedValueOnce(entries()).mockRejectedValueOnce(new Error('ENOENT'));

    const result = await orchestrator.syncAll([createDefaultMapping()]);

    expect(result).toEqual({ synced: 0, failed: 0, deleted: 0 });
    expect(mockVault.trash).not.toHaveBeenCalled();
  });

  it('orphan cleanup: skips when metadata has no source', async () => {
    mockFs.readdir
      .mockResolvedValueOnce(entries())
      .mockResolvedValueOnce(entries('file.excalidraw.md'));
    mockService.handleFileDelete.mockResolvedValue(true);
    mockMetadata.getMetadata.mockResolvedValue({
      source: null,
      mtime: null,
    });

    const result = await orchestrator.syncAll([createDefaultMapping()]);

    expect(result).toEqual({ synced: 0, failed: 0, deleted: 0 });
    expect(mockVault.trash).not.toHaveBeenCalled();
  });

  it('orphan cleanup: does not delete when source exists', async () => {
    mockFs.readdir
      .mockResolvedValueOnce(entries())
      .mockResolvedValueOnce(entries('file.excalidraw.md'));
    mockService.handleFileDelete.mockResolvedValue(true);
    mockMetadata.getMetadata.mockResolvedValue({
      source: '/watch/file.note',
      mtime: 1000,
    });
    mockFs.access.mockResolvedValue(undefined);

    const result = await orchestrator.syncAll([createDefaultMapping()]);

    expect(result).toEqual({ synced: 0, failed: 0, deleted: 0 });
    expect(mockVault.trash).not.toHaveBeenCalled();
  });

  it('readData calls SyncFileSystem.readFile', async () => {
    const testBuffer = new ArrayBuffer(16);
    mockFs.readdir.mockResolvedValue(entries('file.note'));
    mockFs.stat.mockResolvedValue({ mtimeMs: 2000 });
    mockFs.readFile.mockResolvedValue(testBuffer);
    mockService.handleFileChange.mockImplementation(
      async (event: { readData: () => Promise<ArrayBuffer> }) => {
        const data = await event.readData();
        expect(data).toBe(testBuffer);
        return {
          content: 'test',
          assets: new Map(),
          metadata: { source: '/watch/file.note', mtime: 2000 },
        };
      },
    );

    await orchestrator.syncAll([createDefaultMapping()]);

    expect(mockFs.readFile).toHaveBeenCalledWith('/watch/file.note');
  });
});
