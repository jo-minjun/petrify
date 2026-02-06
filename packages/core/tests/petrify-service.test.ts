import { describe, it, expect, vi } from 'vitest';
import { PetrifyService } from '../src/petrify-service.js';
import type { ParserPort } from '../src/ports/parser.js';
import type { FileGeneratorPort } from '../src/ports/file-generator.js';
import type { ConversionMetadataPort } from '../src/ports/conversion-metadata.js';
import type { FileSystemPort } from '../src/ports/file-system.js';
import type { FileChangeEvent } from '../src/ports/watcher.js';
import type { OcrPort } from '../src/ports/ocr.js';
import type { Note, Page } from '../src/models/index.js';
import { ConversionError, ParseError, OcrRecognitionError } from '../src/exceptions.js';

function createMockParserPort(): ParserPort {
  return {
    extensions: ['.note'],
    parse: vi.fn(),
  };
}

function createMockGeneratorPort(): FileGeneratorPort {
  return {
    id: 'test-generator',
    displayName: 'Test Generator',
    extension: '.excalidraw.md',
    generate: vi.fn(),
  };
}

function createMockMetadataPort(): ConversionMetadataPort {
  return {
    getMetadata: vi.fn(),
    formatMetadata: vi.fn(),
  };
}

function createMockFileSystemPort(): FileSystemPort {
  return {
    writeFile: vi.fn(),
    writeAsset: vi.fn(),
    exists: vi.fn(),
  };
}

describe('PetrifyService', () => {
  describe('handleFileChange', () => {
    it('지원하지 않는 확장자는 null 반환', async () => {
      const parsers = new Map<string, ParserPort>();
      const service = new PetrifyService(
        parsers,
        createMockGeneratorPort(),
        null,
        createMockMetadataPort(),
        createMockFileSystemPort(),
        { confidenceThreshold: 0.5 },
      );

      const event: FileChangeEvent = {
        id: '/path/to/file.unknown',
        name: 'file.unknown',
        extension: '.unknown',
        mtime: Date.now(),
        readData: vi.fn(),
      };

      const result = await service.handleFileChange(event, 'output');
      expect(result).toBeNull();
    });

    it('mtime이 같거나 이전이면 null 반환', async () => {
      const mockParser = createMockParserPort();
      const parsers = new Map<string, ParserPort>([['.note', mockParser]]);

      const mockMetadata = createMockMetadataPort();
      vi.mocked(mockMetadata.getMetadata).mockResolvedValue({
        source: '/path/to/file.note',
        mtime: 1000,
      });

      const service = new PetrifyService(
        parsers,
        createMockGeneratorPort(),
        null,
        mockMetadata,
        createMockFileSystemPort(),
        { confidenceThreshold: 0.5 },
      );

      const event: FileChangeEvent = {
        id: '/path/to/file.note',
        name: 'file.note',
        extension: '.note',
        mtime: 1000,
        readData: vi.fn(),
      };

      const result = await service.handleFileChange(event, 'output');
      expect(result).toBeNull();
    });
  });

  describe('handleFileDelete', () => {
    it('메타데이터가 없으면 false 반환', async () => {
      const mockMetadata = createMockMetadataPort();
      vi.mocked(mockMetadata.getMetadata).mockResolvedValue(undefined);

      const service = new PetrifyService(
        new Map(),
        createMockGeneratorPort(),
        null,
        mockMetadata,
        createMockFileSystemPort(),
        { confidenceThreshold: 0.5 },
      );

      const result = await service.handleFileDelete('output/file.excalidraw.md');
      expect(result).toBe(false);
    });

    it('keep이 true면 false 반환', async () => {
      const mockMetadata = createMockMetadataPort();
      vi.mocked(mockMetadata.getMetadata).mockResolvedValue({
        source: null,
        mtime: null,
        keep: true,
      });

      const service = new PetrifyService(
        new Map(),
        createMockGeneratorPort(),
        null,
        mockMetadata,
        createMockFileSystemPort(),
        { confidenceThreshold: 0.5 },
      );

      const result = await service.handleFileDelete('output/file.excalidraw.md');
      expect(result).toBe(false);
    });

    it('삭제 가능하면 true 반환', async () => {
      const mockMetadata = createMockMetadataPort();
      vi.mocked(mockMetadata.getMetadata).mockResolvedValue({
        source: '/path/to/file.note',
        mtime: 1000,
      });

      const service = new PetrifyService(
        new Map(),
        createMockGeneratorPort(),
        null,
        mockMetadata,
        createMockFileSystemPort(),
        { confidenceThreshold: 0.5 },
      );

      const result = await service.handleFileDelete('output/file.excalidraw.md');
      expect(result).toBe(true);
    });
  });

  describe('변환 플로우', () => {
    function createTestPage(overrides?: Partial<Page>): Page {
      return {
        id: 'page-1',
        order: 0,
        width: 100,
        height: 100,
        imageData: new Uint8Array([1, 2, 3]),
        ...overrides,
      };
    }

    function createTestNote(overrides?: Partial<Note>): Note {
      return {
        title: 'test',
        pages: [createTestPage()],
        createdAt: new Date(),
        modifiedAt: new Date(),
        ...overrides,
      };
    }

    function createMockOcrPort(): OcrPort {
      return {
        recognize: vi.fn(),
      };
    }

    it('OCR 없이 변환', async () => {
      const mockParser = createMockParserPort();
      const note = createTestNote();
      vi.mocked(mockParser.parse).mockResolvedValue(note);

      const mockGenerator = createMockGeneratorPort();
      vi.mocked(mockGenerator.generate).mockReturnValue({
        content: 'test-content',
        assets: undefined as unknown as ReadonlyMap<string, Uint8Array>,
        extension: '.excalidraw.md',
      });

      const mockMetadata = createMockMetadataPort();
      vi.mocked(mockMetadata.getMetadata).mockResolvedValue(undefined);
      vi.mocked(mockMetadata.formatMetadata).mockReturnValue('---\nfrontmatter\n---\n');

      const mockFileSystem = createMockFileSystemPort();

      const parsers = new Map<string, ParserPort>([['.note', mockParser]]);
      const service = new PetrifyService(
        parsers,
        mockGenerator,
        null,
        mockMetadata,
        mockFileSystem,
        { confidenceThreshold: 50 },
      );

      const event: FileChangeEvent = {
        id: '/path/to/file.note',
        name: 'file.note',
        extension: '.note',
        mtime: 2000,
        readData: vi.fn<() => Promise<ArrayBuffer>>().mockResolvedValue(new ArrayBuffer(8)),
      };

      const result = await service.handleFileChange(event, 'output');

      expect(result).toBe('output/file.excalidraw.md');
      expect(mockFileSystem.writeFile).toHaveBeenCalledWith(
        'output/file.excalidraw.md',
        '---\nfrontmatter\n---\ntest-content',
      );
      expect(mockMetadata.formatMetadata).toHaveBeenCalledWith({
        source: event.id,
        mtime: event.mtime,
      });
    });

    it('OCR 포함 변환', async () => {
      const mockParser = createMockParserPort();
      const note = createTestNote();
      vi.mocked(mockParser.parse).mockResolvedValue(note);

      const mockGenerator = createMockGeneratorPort();
      vi.mocked(mockGenerator.generate).mockReturnValue({
        content: 'test-content',
        assets: undefined as unknown as ReadonlyMap<string, Uint8Array>,
        extension: '.excalidraw.md',
      });

      const mockMetadata = createMockMetadataPort();
      vi.mocked(mockMetadata.getMetadata).mockResolvedValue(undefined);
      vi.mocked(mockMetadata.formatMetadata).mockReturnValue('---\nfrontmatter\n---\n');

      const mockFileSystem = createMockFileSystemPort();

      const mockOcr = createMockOcrPort();
      vi.mocked(mockOcr.recognize).mockResolvedValue({
        text: 'hello',
        confidence: 90,
        regions: [{ text: 'hello', confidence: 90, x: 0, y: 0, width: 50, height: 20 }],
      });

      const parsers = new Map<string, ParserPort>([['.note', mockParser]]);
      const service = new PetrifyService(
        parsers,
        mockGenerator,
        mockOcr,
        mockMetadata,
        mockFileSystem,
        { confidenceThreshold: 50 },
      );

      const event: FileChangeEvent = {
        id: '/path/to/file.note',
        name: 'file.note',
        extension: '.note',
        mtime: 2000,
        readData: vi.fn<() => Promise<ArrayBuffer>>().mockResolvedValue(new ArrayBuffer(8)),
      };

      await service.handleFileChange(event, 'output');

      const generateCall = vi.mocked(mockGenerator.generate).mock.calls[0];
      const ocrResults = generateCall[2];
      expect(ocrResults).toBeDefined();
      expect(ocrResults!.length).toBeGreaterThan(0);
      expect(ocrResults![0].texts).toContain('hello');
    });

    it('OCR confidence 필터링', async () => {
      const mockParser = createMockParserPort();
      const note = createTestNote();
      vi.mocked(mockParser.parse).mockResolvedValue(note);

      const mockGenerator = createMockGeneratorPort();
      vi.mocked(mockGenerator.generate).mockReturnValue({
        content: 'test-content',
        assets: undefined as unknown as ReadonlyMap<string, Uint8Array>,
        extension: '.excalidraw.md',
      });

      const mockMetadata = createMockMetadataPort();
      vi.mocked(mockMetadata.getMetadata).mockResolvedValue(undefined);
      vi.mocked(mockMetadata.formatMetadata).mockReturnValue('');

      const mockFileSystem = createMockFileSystemPort();

      const mockOcr = createMockOcrPort();
      vi.mocked(mockOcr.recognize).mockResolvedValue({
        text: 'low high',
        regions: [
          { text: 'low', confidence: 30, x: 0, y: 0, width: 50, height: 20 },
          { text: 'high', confidence: 80, x: 0, y: 20, width: 50, height: 20 },
        ],
      });

      const parsers = new Map<string, ParserPort>([['.note', mockParser]]);
      const service = new PetrifyService(
        parsers,
        mockGenerator,
        mockOcr,
        mockMetadata,
        mockFileSystem,
        { confidenceThreshold: 50 },
      );

      const event: FileChangeEvent = {
        id: '/path/to/file.note',
        name: 'file.note',
        extension: '.note',
        mtime: 2000,
        readData: vi.fn<() => Promise<ArrayBuffer>>().mockResolvedValue(new ArrayBuffer(8)),
      };

      await service.handleFileChange(event, 'output');

      const generateCall = vi.mocked(mockGenerator.generate).mock.calls[0];
      const ocrResults = generateCall[2];
      expect(ocrResults).toBeDefined();
      expect(ocrResults!.length).toBe(1);
      expect(ocrResults![0].texts).toContain('high');
      expect(ocrResults![0].texts).not.toContain('low');
    });

    it('에셋 포함 변환', async () => {
      const mockParser = createMockParserPort();
      const note = createTestNote();
      vi.mocked(mockParser.parse).mockResolvedValue(note);

      const assets = new Map<string, Uint8Array>([
        ['img.png', new Uint8Array([1, 2, 3])],
      ]);
      const mockGenerator = createMockGeneratorPort();
      vi.mocked(mockGenerator.generate).mockReturnValue({
        content: 'test',
        assets,
        extension: '.excalidraw.md',
      });

      const mockMetadata = createMockMetadataPort();
      vi.mocked(mockMetadata.getMetadata).mockResolvedValue(undefined);
      vi.mocked(mockMetadata.formatMetadata).mockReturnValue('');

      const mockFileSystem = createMockFileSystemPort();

      const parsers = new Map<string, ParserPort>([['.note', mockParser]]);
      const service = new PetrifyService(
        parsers,
        mockGenerator,
        null,
        mockMetadata,
        mockFileSystem,
        { confidenceThreshold: 50 },
      );

      const event: FileChangeEvent = {
        id: '/path/to/file.note',
        name: 'file.note',
        extension: '.note',
        mtime: 2000,
        readData: vi.fn<() => Promise<ArrayBuffer>>().mockResolvedValue(new ArrayBuffer(8)),
      };

      await service.handleFileChange(event, 'output');

      expect(mockFileSystem.writeAsset).toHaveBeenCalledWith(
        'output/assets/file',
        'img.png',
        new Uint8Array([1, 2, 3]),
      );
    });

    it('convertDroppedFile 플로우', async () => {
      const mockParser = createMockParserPort();
      const note = createTestNote();
      vi.mocked(mockParser.parse).mockResolvedValue(note);

      const mockGenerator = createMockGeneratorPort();
      vi.mocked(mockGenerator.generate).mockReturnValue({
        content: 'dropped-content',
        assets: undefined as unknown as ReadonlyMap<string, Uint8Array>,
        extension: '.excalidraw.md',
      });

      const mockMetadata = createMockMetadataPort();
      vi.mocked(mockMetadata.formatMetadata).mockReturnValue('---\ndropped\n---\n');

      const mockFileSystem = createMockFileSystemPort();

      const service = new PetrifyService(
        new Map(),
        mockGenerator,
        null,
        mockMetadata,
        mockFileSystem,
        { confidenceThreshold: 50 },
      );

      const data = new ArrayBuffer(8);
      const result = await service.convertDroppedFile(data, mockParser, 'output', 'dropped');

      expect(result).toBe('output/dropped.excalidraw.md');
      expect(mockParser.parse).toHaveBeenCalledWith(data);
      expect(mockMetadata.formatMetadata).toHaveBeenCalledWith({
        source: null,
        mtime: null,
        keep: true,
      });
    });
  });

  describe('에러 전파', () => {
    function createTestPage(): Page {
      return {
        id: 'page-1',
        order: 0,
        width: 100,
        height: 100,
        imageData: new Uint8Array([1, 2, 3]),
      };
    }

    function createTestNote(): Note {
      return {
        title: 'test',
        pages: [createTestPage()],
        createdAt: new Date(),
        modifiedAt: new Date(),
      };
    }

    it('parse 실패 시 ConversionError (phase=parse)', async () => {
      const mockParser = createMockParserPort();
      vi.mocked(mockParser.parse).mockRejectedValue(new ParseError('test'));

      const mockMetadata = createMockMetadataPort();
      vi.mocked(mockMetadata.getMetadata).mockResolvedValue(undefined);

      const parsers = new Map<string, ParserPort>([['.note', mockParser]]);
      const service = new PetrifyService(
        parsers,
        createMockGeneratorPort(),
        null,
        mockMetadata,
        createMockFileSystemPort(),
        { confidenceThreshold: 50 },
      );

      const event: FileChangeEvent = {
        id: '/path/to/file.note',
        name: 'file.note',
        extension: '.note',
        mtime: 2000,
        readData: vi.fn<() => Promise<ArrayBuffer>>().mockResolvedValue(new ArrayBuffer(8)),
      };

      await expect(service.handleFileChange(event, 'output')).rejects.toThrow(ConversionError);
      await expect(service.handleFileChange(event, 'output')).rejects.toMatchObject({
        phase: 'parse',
      });
    });

    it('OCR 실패 시 ConversionError (phase=ocr)', async () => {
      const mockParser = createMockParserPort();
      const note = createTestNote();
      vi.mocked(mockParser.parse).mockResolvedValue(note);

      const mockOcr: OcrPort = {
        recognize: vi.fn<OcrPort['recognize']>().mockRejectedValue(
          new OcrRecognitionError('test'),
        ),
      };

      const mockMetadata = createMockMetadataPort();
      vi.mocked(mockMetadata.getMetadata).mockResolvedValue(undefined);

      const parsers = new Map<string, ParserPort>([['.note', mockParser]]);
      const service = new PetrifyService(
        parsers,
        createMockGeneratorPort(),
        mockOcr,
        mockMetadata,
        createMockFileSystemPort(),
        { confidenceThreshold: 50 },
      );

      const event: FileChangeEvent = {
        id: '/path/to/file.note',
        name: 'file.note',
        extension: '.note',
        mtime: 2000,
        readData: vi.fn<() => Promise<ArrayBuffer>>().mockResolvedValue(new ArrayBuffer(8)),
      };

      await expect(service.handleFileChange(event, 'output')).rejects.toThrow(ConversionError);
      await expect(service.handleFileChange(event, 'output')).rejects.toMatchObject({
        phase: 'ocr',
      });
    });

    it('save 실패 시 ConversionError (phase=save)', async () => {
      const mockParser = createMockParserPort();
      const note = createTestNote();
      vi.mocked(mockParser.parse).mockResolvedValue(note);

      const mockGenerator = createMockGeneratorPort();
      vi.mocked(mockGenerator.generate).mockReturnValue({
        content: 'test-content',
        assets: undefined as unknown as ReadonlyMap<string, Uint8Array>,
        extension: '.excalidraw.md',
      });

      const mockMetadata = createMockMetadataPort();
      vi.mocked(mockMetadata.getMetadata).mockResolvedValue(undefined);
      vi.mocked(mockMetadata.formatMetadata).mockReturnValue('');

      const mockFileSystem = createMockFileSystemPort();
      vi.mocked(mockFileSystem.writeFile).mockRejectedValue(new Error('disk full'));

      const parsers = new Map<string, ParserPort>([['.note', mockParser]]);
      const service = new PetrifyService(
        parsers,
        mockGenerator,
        null,
        mockMetadata,
        mockFileSystem,
        { confidenceThreshold: 50 },
      );

      const event: FileChangeEvent = {
        id: '/path/to/file.note',
        name: 'file.note',
        extension: '.note',
        mtime: 2000,
        readData: vi.fn<() => Promise<ArrayBuffer>>().mockResolvedValue(new ArrayBuffer(8)),
      };

      await expect(service.handleFileChange(event, 'output')).rejects.toThrow(ConversionError);
      await expect(service.handleFileChange(event, 'output')).rejects.toMatchObject({
        phase: 'save',
      });
    });
  });
});
