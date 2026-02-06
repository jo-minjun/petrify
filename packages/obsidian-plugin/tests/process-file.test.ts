import type { ConversionResult, FileChangeEvent, PetrifyService } from '@petrify/core';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Logger } from '../src/logger.js';
import type { SaveFn } from '../src/process-file.js';
import { processFile } from '../src/process-file.js';

vi.mock('obsidian', () => ({
  Notice: vi.fn(),
}));

function createMockLogger(): { [K in keyof Logger]: ReturnType<typeof vi.fn> } {
  return { info: vi.fn(), error: vi.fn(), notify: vi.fn() };
}

function createFileChangeEvent(name: string): FileChangeEvent {
  return {
    id: `/watch/${name}`,
    name,
    extension: '.note',
    mtime: 1000,
    readData: vi.fn().mockResolvedValue(new ArrayBuffer(8)),
  };
}

describe('processFile', () => {
  let mockService: { handleFileChange: ReturnType<typeof vi.fn> };
  let save: ReturnType<typeof vi.fn>;
  let log: ReturnType<typeof createMockLogger>;

  beforeEach(() => {
    mockService = { handleFileChange: vi.fn() };
    save = vi.fn().mockResolvedValue('output/file.excalidraw.md');
    log = createMockLogger();
  });

  it('handleFileChange가 null 반환 시 false (스킵)', async () => {
    mockService.handleFileChange.mockResolvedValue(null);

    const result = await processFile(
      createFileChangeEvent('file.note'),
      'output',
      mockService as unknown as PetrifyService,
      save as SaveFn,
      log,
    );

    expect(result).toBe(false);
    expect(save).not.toHaveBeenCalled();
  });

  it('변환 결과가 있으면 save 호출 후 true 반환', async () => {
    const conversionResult: ConversionResult = {
      content: '# test',
      assets: new Map(),
      metadata: { source: '/watch/file.note', mtime: 1000 },
    };
    mockService.handleFileChange.mockResolvedValue(conversionResult);

    const result = await processFile(
      createFileChangeEvent('file.note'),
      'output',
      mockService as unknown as PetrifyService,
      save as SaveFn,
      log,
    );

    expect(result).toBe(true);
    expect(save).toHaveBeenCalledWith(conversionResult, 'output', 'file');
    expect(log.info).toHaveBeenCalledWith('Converted: file.note -> output/file.excalidraw.md');
  });

  it('파일명에서 확장자를 제거한 baseName으로 save 호출', async () => {
    mockService.handleFileChange.mockResolvedValue({
      content: '',
      assets: new Map(),
      metadata: { source: '', mtime: 0 },
    });

    await processFile(
      createFileChangeEvent('my-document.note'),
      'output',
      mockService as unknown as PetrifyService,
      save as SaveFn,
      log,
    );

    expect(save).toHaveBeenCalledWith(expect.anything(), 'output', 'my-document');
  });
});
