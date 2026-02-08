import type { ConversionResult, ParserPort, PetrifyService } from '@petrify/core';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { SaveConversionFn } from '../src/drop-handler.js';
import { DropHandler } from '../src/drop-handler.js';

vi.mock('obsidian', () => ({
  Notice: vi.fn(),
}));

vi.mock('../src/parser-select-modal.js', () => ({
  ParserSelectModal: vi.fn(),
}));

function createMockParser(extensions: string[]): ParserPort {
  return { extensions, parse: vi.fn() };
}

function createMockPetrifyService(parsers: ParserPort[] = []): {
  getParsersForExtension: ReturnType<typeof vi.fn>;
  convertDroppedFile: ReturnType<typeof vi.fn>;
} {
  return {
    getParsersForExtension: vi.fn().mockReturnValue(parsers),
    convertDroppedFile: vi.fn(),
  };
}

function createMockConversionResult(): ConversionResult {
  return {
    content: '# converted',
    assets: new Map(),
    metadata: { source: null, mtime: null, keep: true },
  };
}

function createMockFile(name: string, content = new ArrayBuffer(8)): File {
  return {
    name,
    arrayBuffer: vi.fn().mockResolvedValue(content),
  } as unknown as File;
}

function createMockFileList(files: File[]): FileList {
  const list = {
    length: files.length,
    item: (i: number) => files[i] ?? null,
    [Symbol.iterator]: function* () {
      for (const f of files) yield f;
    },
  } as unknown as FileList;

  for (let i = 0; i < files.length; i++) {
    Object.defineProperty(list, i, { value: files[i], enumerable: true });
  }
  return list;
}

function createDragEvent(options: { target: Partial<HTMLElement>; files?: FileList }): DragEvent {
  return {
    target: options.target,
    dataTransfer: options.files ? { files: options.files } : null,
    preventDefault: vi.fn(),
    stopPropagation: vi.fn(),
  } as unknown as DragEvent;
}

function createFileExplorerTarget(dataPath?: string): Partial<HTMLElement> {
  const navContainer = {};
  return {
    closest: vi.fn().mockImplementation((selector: string) => {
      if (selector === '.nav-files-container') return navContainer;
      if (selector === '[data-path]' && dataPath !== undefined) {
        return { getAttribute: () => dataPath };
      }
      return null;
    }),
  };
}

function createNonFileExplorerTarget(): Partial<HTMLElement> {
  return {
    closest: vi.fn().mockReturnValue(null),
  };
}

describe('DropHandler', () => {
  let handler: DropHandler;
  let mockService: ReturnType<typeof createMockPetrifyService>;
  let mockParser: ParserPort;
  let saveResult: ReturnType<typeof vi.fn>;
  const mockApp = {} as unknown as import('obsidian').App;

  beforeEach(() => {
    mockParser = createMockParser(['.note']);
    mockService = createMockPetrifyService([mockParser]);
    saveResult = vi.fn().mockResolvedValue('output/file.excalidraw.md');

    handler = new DropHandler(
      mockApp,
      mockService as unknown as PetrifyService,
      new Map([['viwoods', mockParser]]),
      saveResult as SaveConversionFn,
    );
  });

  it('파일 탐색기 외부 드롭은 무시', async () => {
    const files = createMockFileList([createMockFile('test.note')]);
    const evt = createDragEvent({
      target: createNonFileExplorerTarget(),
      files,
    });

    await handler.handleDrop(evt);

    expect(evt.preventDefault).not.toHaveBeenCalled();
    expect(mockService.convertDroppedFile).not.toHaveBeenCalled();
  });

  it('dataTransfer가 없으면 무시', async () => {
    const evt = createDragEvent({
      target: createFileExplorerTarget('folder'),
    });

    await handler.handleDrop(evt);

    expect(mockService.convertDroppedFile).not.toHaveBeenCalled();
  });

  it('빈 파일 목록은 무시', async () => {
    const evt = createDragEvent({
      target: createFileExplorerTarget('folder'),
      files: createMockFileList([]),
    });

    await handler.handleDrop(evt);

    expect(evt.preventDefault).not.toHaveBeenCalled();
  });

  it('지원하지 않는 확장자 파일만 있으면 무시', async () => {
    mockService.getParsersForExtension.mockReturnValue([]);
    const files = createMockFileList([createMockFile('readme.txt')]);
    const evt = createDragEvent({
      target: createFileExplorerTarget('folder'),
      files,
    });

    await handler.handleDrop(evt);

    expect(evt.preventDefault).not.toHaveBeenCalled();
    expect(mockService.convertDroppedFile).not.toHaveBeenCalled();
  });

  it('지원되는 파일 → 변환 성공', async () => {
    const mockResult = createMockConversionResult();
    mockService.convertDroppedFile.mockResolvedValue(mockResult);

    const files = createMockFileList([createMockFile('test.note')]);
    const evt = createDragEvent({
      target: createFileExplorerTarget('notes'),
      files,
    });

    await handler.handleDrop(evt);

    expect(evt.preventDefault).toHaveBeenCalled();
    expect(evt.stopPropagation).toHaveBeenCalled();
    expect(mockService.convertDroppedFile).toHaveBeenCalledWith(
      expect.any(ArrayBuffer),
      mockParser,
      'test',
    );
    expect(saveResult).toHaveBeenCalledWith(mockResult, 'notes', 'test');
  });

  it('변환 실패 시 에러 카운트 증가 (다른 파일은 계속 처리)', async () => {
    mockService.convertDroppedFile
      .mockRejectedValueOnce(new Error('parse failed'))
      .mockResolvedValueOnce(createMockConversionResult());

    const files = createMockFileList([createMockFile('bad.note'), createMockFile('good.note')]);
    const evt = createDragEvent({
      target: createFileExplorerTarget('notes'),
      files,
    });

    await handler.handleDrop(evt);

    expect(mockService.convertDroppedFile).toHaveBeenCalledTimes(2);
    expect(saveResult).toHaveBeenCalledTimes(1);
  });

  it('드롭 폴더 경로를 data-path에서 추출', async () => {
    mockService.convertDroppedFile.mockResolvedValue(createMockConversionResult());
    const files = createMockFileList([createMockFile('test.note')]);
    const evt = createDragEvent({
      target: createFileExplorerTarget('deep/nested/folder'),
      files,
    });

    await handler.handleDrop(evt);

    expect(saveResult).toHaveBeenCalledWith(expect.anything(), 'deep/nested/folder', 'test');
  });

  it('updateService 후 새 서비스로 변환 수행', async () => {
    const newParser = createMockParser(['.note']);
    const newService = createMockPetrifyService([newParser]);
    const newResult: ConversionResult = {
      content: '# markdown content',
      assets: new Map(),
      metadata: { source: null, mtime: null, keep: true },
    };
    newService.convertDroppedFile.mockResolvedValue(newResult);

    handler.updateService(
      newService as unknown as PetrifyService,
      new Map([['viwoods', newParser]]),
    );

    const files = createMockFileList([createMockFile('test.note')]);
    const evt = createDragEvent({
      target: createFileExplorerTarget('notes'),
      files,
    });

    await handler.handleDrop(evt);

    expect(mockService.convertDroppedFile).not.toHaveBeenCalled();
    expect(newService.convertDroppedFile).toHaveBeenCalledWith(
      expect.any(ArrayBuffer),
      newParser,
      'test',
    );
    expect(saveResult).toHaveBeenCalledWith(newResult, 'notes', 'test');
  });

  it('data-path 없으면 루트 폴더("")로 저장', async () => {
    const target: Partial<HTMLElement> = {
      closest: vi.fn().mockImplementation((selector: string) => {
        if (selector === '.nav-files-container') return {};
        if (selector === '[data-path]') return null;
        return null;
      }),
    };
    mockService.convertDroppedFile.mockResolvedValue(createMockConversionResult());
    const files = createMockFileList([createMockFile('test.note')]);
    const evt = createDragEvent({ target, files });

    await handler.handleDrop(evt);

    expect(saveResult).toHaveBeenCalledWith(expect.anything(), '', 'test');
  });
});
