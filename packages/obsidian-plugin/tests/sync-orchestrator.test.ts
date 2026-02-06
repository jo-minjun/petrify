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
import type { WatchMapping } from '../src/settings.js';
import type { SyncFileSystem, VaultOperations } from '../src/sync-orchestrator.js';
import { SyncOrchestrator } from '../src/sync-orchestrator.js';

vi.mock('obsidian', () => ({
  Notice: vi.fn(),
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

function createDefaultMapping(overrides?: Partial<WatchMapping>): WatchMapping {
  return {
    watchDir: '/watch',
    outputDir: 'output',
    enabled: true,
    parserId: 'viwoods',
    sourceType: 'local',
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

  it('정상 sync: 파일 발견 후 변환 성공', async () => {
    mockFs.readdir.mockResolvedValue(['file.note']);
    mockFs.stat.mockResolvedValue({ mtimeMs: 1000 });
    mockFs.readFile.mockResolvedValue(new ArrayBuffer(8));
    mockService.handleFileChange.mockResolvedValue({
      content: 'test',
      assets: new Map(),
      metadata: { source: '/watch/file.note', mtime: 1000 },
    });

    const result = await orchestrator.syncAll([createDefaultMapping()], false);

    expect(result).toEqual({ synced: 1, failed: 0, deleted: 0 });
    expect(mockService.handleFileChange).toHaveBeenCalledOnce();
    expect(convertLog.info).toHaveBeenCalledWith(expect.stringContaining('Converted: file.note'));
  });

  it('디렉토리 읽기 실패 시 failed 증가', async () => {
    mockFs.readdir.mockRejectedValue(new Error('ENOENT'));

    const result = await orchestrator.syncAll([createDefaultMapping()], false);

    expect(result).toEqual({ synced: 0, failed: 1, deleted: 0 });
    expect(syncLog.error).toHaveBeenCalledWith('Directory unreadable: /watch');
  });

  it('파일 stat 실패 시 failed 증가', async () => {
    mockFs.readdir.mockResolvedValue(['file.note']);
    mockFs.stat.mockRejectedValue(new Error('EACCES'));

    const result = await orchestrator.syncAll([createDefaultMapping()], false);

    expect(result).toEqual({ synced: 0, failed: 1, deleted: 0 });
    expect(syncLog.error).toHaveBeenCalledWith('File stat failed: file.note');
  });

  it('변환 실패 시 ConversionError 메시지로 failed 증가', async () => {
    mockFs.readdir.mockResolvedValue(['file.note']);
    mockFs.stat.mockResolvedValue({ mtimeMs: 1000 });
    mockFs.readFile.mockResolvedValue(new ArrayBuffer(8));
    mockService.handleFileChange.mockRejectedValue(
      new ConversionError('parse', new Error('invalid format')),
    );

    const result = await orchestrator.syncAll([createDefaultMapping()], false);

    expect(result).toEqual({ synced: 0, failed: 1, deleted: 0 });
    expect(convertLog.error).toHaveBeenCalledWith(
      'Parse failed: file.note',
      expect.any(ConversionError),
    );
  });

  it('이미 변환된 파일은 스킵 (handleFileChange가 null 반환)', async () => {
    mockFs.readdir.mockResolvedValue(['file.note']);
    mockFs.stat.mockResolvedValue({ mtimeMs: 1000 });
    mockFs.readFile.mockResolvedValue(new ArrayBuffer(8));
    mockService.handleFileChange.mockResolvedValue(null);

    const result = await orchestrator.syncAll([createDefaultMapping()], false);

    expect(result).toEqual({ synced: 0, failed: 0, deleted: 0 });
  });

  it('orphan 정리: 원본 없는 변환 파일 삭제', async () => {
    mockFs.readdir.mockResolvedValueOnce([]).mockResolvedValueOnce(['file.excalidraw.md']);
    mockService.handleFileDelete.mockResolvedValue(true);
    mockMetadata.getMetadata.mockResolvedValue({
      source: '/watch/file.note',
      mtime: 1000,
    });
    mockFs.access.mockRejectedValue(new Error('ENOENT'));
    mockVault.trash.mockResolvedValue(undefined);
    mockFs.rm.mockResolvedValue(undefined);

    const result = await orchestrator.syncAll([createDefaultMapping()], true);

    expect(result).toEqual({ synced: 0, failed: 0, deleted: 1 });
    expect(mockVault.trash).toHaveBeenCalledWith('output/file.excalidraw.md');
    expect(mockFs.rm).toHaveBeenCalledWith('/vault/output/assets/file', { recursive: true });
  });

  it('orphan 정리: keep=true 파일은 삭제하지 않음', async () => {
    mockFs.readdir.mockResolvedValueOnce([]).mockResolvedValueOnce(['file.excalidraw.md']);
    mockService.handleFileDelete.mockResolvedValue(false);

    const result = await orchestrator.syncAll([createDefaultMapping()], true);

    expect(result).toEqual({ synced: 0, failed: 0, deleted: 0 });
    expect(mockVault.trash).not.toHaveBeenCalled();
  });

  it('지원하지 않는 확장자 파일은 무시', async () => {
    mockFs.readdir.mockResolvedValue(['file.txt', 'readme.md']);

    const result = await orchestrator.syncAll([createDefaultMapping()], false);

    expect(result).toEqual({ synced: 0, failed: 0, deleted: 0 });
    expect(mockService.handleFileChange).not.toHaveBeenCalled();
  });

  it('비활성화된 매핑은 건너뜀', async () => {
    const mapping = createDefaultMapping({ enabled: false });

    const result = await orchestrator.syncAll([mapping], false);

    expect(result).toEqual({ synced: 0, failed: 0, deleted: 0 });
    expect(mockFs.readdir).not.toHaveBeenCalled();
  });

  it('watchDir 또는 outputDir가 빈 문자열이면 건너뜀', async () => {
    const mapping = createDefaultMapping({ watchDir: '' });

    const result = await orchestrator.syncAll([mapping], false);

    expect(result).toEqual({ synced: 0, failed: 0, deleted: 0 });
    expect(mockFs.readdir).not.toHaveBeenCalled();
  });

  it('알 수 없는 parserId일 때 failed 증가', async () => {
    const mapping = createDefaultMapping({ parserId: 'unknown' });

    const result = await orchestrator.syncAll([mapping], false);

    expect(result).toEqual({ synced: 0, failed: 1, deleted: 0 });
    expect(syncLog.error).toHaveBeenCalledWith('Unknown parser: unknown');
  });

  it('여러 매핑의 결과를 합산', async () => {
    const mapping1 = createDefaultMapping({ watchDir: '/watch1' });
    const mapping2 = createDefaultMapping({ watchDir: '/watch2' });

    mockFs.readdir.mockResolvedValue(['file.note']);
    mockFs.stat.mockResolvedValue({ mtimeMs: 1000 });
    mockFs.readFile.mockResolvedValue(new ArrayBuffer(8));
    mockService.handleFileChange.mockResolvedValue({
      content: 'test',
      assets: new Map(),
      metadata: { source: '/watch/file.note', mtime: 1000 },
    });

    const result = await orchestrator.syncAll([mapping1, mapping2], false);

    expect(result).toEqual({ synced: 2, failed: 0, deleted: 0 });
  });

  it('orphan assets 삭제 실패 시에도 deleted 카운트 유지', async () => {
    mockFs.readdir.mockResolvedValueOnce([]).mockResolvedValueOnce(['file.excalidraw.md']);
    mockService.handleFileDelete.mockResolvedValue(true);
    mockMetadata.getMetadata.mockResolvedValue({
      source: '/watch/file.note',
      mtime: 1000,
    });
    mockFs.access.mockRejectedValue(new Error('ENOENT'));
    mockVault.trash.mockResolvedValue(undefined);
    mockFs.rm.mockRejectedValue(new Error('ENOENT'));

    const result = await orchestrator.syncAll([createDefaultMapping()], true);

    expect(result).toEqual({ synced: 0, failed: 0, deleted: 1 });
  });

  it('orphan 정리: 출력 디렉토리 읽기 실패 시 continue', async () => {
    mockFs.readdir.mockResolvedValueOnce([]).mockRejectedValueOnce(new Error('ENOENT'));

    const result = await orchestrator.syncAll([createDefaultMapping()], true);

    expect(result).toEqual({ synced: 0, failed: 0, deleted: 0 });
    expect(mockVault.trash).not.toHaveBeenCalled();
  });

  it('orphan 정리: metadata에 source가 없으면 건너뜀', async () => {
    mockFs.readdir.mockResolvedValueOnce([]).mockResolvedValueOnce(['file.excalidraw.md']);
    mockService.handleFileDelete.mockResolvedValue(true);
    mockMetadata.getMetadata.mockResolvedValue({
      source: null,
      mtime: null,
    });

    const result = await orchestrator.syncAll([createDefaultMapping()], true);

    expect(result).toEqual({ synced: 0, failed: 0, deleted: 0 });
    expect(mockVault.trash).not.toHaveBeenCalled();
  });

  it('orphan 정리: 원본이 존재하면 삭제하지 않음', async () => {
    mockFs.readdir.mockResolvedValueOnce([]).mockResolvedValueOnce(['file.excalidraw.md']);
    mockService.handleFileDelete.mockResolvedValue(true);
    mockMetadata.getMetadata.mockResolvedValue({
      source: '/watch/file.note',
      mtime: 1000,
    });
    mockFs.access.mockResolvedValue(undefined);

    const result = await orchestrator.syncAll([createDefaultMapping()], true);

    expect(result).toEqual({ synced: 0, failed: 0, deleted: 0 });
    expect(mockVault.trash).not.toHaveBeenCalled();
  });

  it('deleteOnSourceDelete가 false면 orphan 정리를 건너뜀', async () => {
    mockFs.readdir.mockResolvedValue([]);

    const result = await orchestrator.syncAll([createDefaultMapping()], false);

    expect(result).toEqual({ synced: 0, failed: 0, deleted: 0 });
    expect(mockFs.readdir).toHaveBeenCalledOnce();
  });

  it('readData는 SyncFileSystem.readFile을 호출', async () => {
    const testBuffer = new ArrayBuffer(16);
    mockFs.readdir.mockResolvedValue(['file.note']);
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

    await orchestrator.syncAll([createDefaultMapping()], false);

    expect(mockFs.readFile).toHaveBeenCalledWith('/watch/file.note');
  });
});
