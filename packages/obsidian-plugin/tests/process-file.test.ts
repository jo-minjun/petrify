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

  it('returns false (skip) when handleFileChange returns null', async () => {
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

  it('calls save and returns true when a conversion result exists', async () => {
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

  it('calls save with baseName derived by removing the extension from the filename', async () => {
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
