import { describe, it, expect, vi } from 'vitest';
import { PetrifyService } from '../src/petrify-service.js';
import type { ParserPort } from '../src/ports/parser.js';
import type { FileGeneratorPort } from '../src/ports/file-generator.js';
import type { ConversionMetadataPort } from '../src/ports/conversion-metadata.js';
import type { FileChangeEvent } from '../src/ports/watcher.js';
import type { OcrPort } from '../src/ports/ocr.js';
import type { Note, Page } from '../src/models/index.js';
import type { GeneratorOutput } from '../src/ports/file-generator.js';
import { ConversionError, ParseError, OcrRecognitionError } from '../src/exceptions.js';

function mockGeneratorOutput(overrides?: Partial<GeneratorOutput>): GeneratorOutput {
  return {
    content: '',
    assets: new Map(),
    extension: '.excalidraw.md',
    ...overrides,
  };
}

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

describe('PetrifyService', () => {
  describe('handleFileChange', () => {
    it('지원하지 않는 확장자는 null 반환', async () => {
      const parsers = new Map<string, ParserPort>();
      const service = new PetrifyService(
        parsers,
        createMockGeneratorPort(),
        null,
        createMockMetadataPort(),
        { confidenceThreshold: 0.5 },
      );

      const event: FileChangeEvent = {
        id: '/path/to/file.unknown',
        name: 'file.unknown',
        extension: '.unknown',
        mtime: Date.now(),
        readData: vi.fn(),
      };

      const result = await service.handleFileChange(event);
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
        { confidenceThreshold: 0.5 },
      );

      const event: FileChangeEvent = {
        id: '/path/to/file.note',
        name: 'file.note',
        extension: '.note',
        mtime: 1000,
        readData: vi.fn(),
      };

      const result = await service.handleFileChange(event);
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
        { confidenceThreshold: 0.5 },
      );

      const result = await service.handleFileDelete('output/file.excalidraw.md');
      expect(result).toBe(true);
    });
  });

  describe('getParsersForExtension', () => {
    it('등록된 확장자에 대해 파서 반환', () => {
      const mockParser = createMockParserPort();
      const parsers = new Map<string, ParserPort>([['.note', mockParser]]);
      const service = new PetrifyService(
        parsers,
        createMockGeneratorPort(),
        null,
        createMockMetadataPort(),
        { confidenceThreshold: 50 },
      );

      const result = service.getParsersForExtension('.note');
      expect(result).toHaveLength(1);
      expect(result[0]).toBe(mockParser);
    });

    it('미등록 확장자에 대해 빈 배열 반환', () => {
      const service = new PetrifyService(
        new Map(),
        createMockGeneratorPort(),
        null,
        createMockMetadataPort(),
        { confidenceThreshold: 50 },
      );

      const result = service.getParsersForExtension('.unknown');
      expect(result).toHaveLength(0);
    });

    it('대소문자 무시하여 파서 반환', () => {
      const mockParser = createMockParserPort();
      const parsers = new Map<string, ParserPort>([['.note', mockParser]]);
      const service = new PetrifyService(
        parsers,
        createMockGeneratorPort(),
        null,
        createMockMetadataPort(),
        { confidenceThreshold: 50 },
      );

      const result = service.getParsersForExtension('.NOTE');
      expect(result).toHaveLength(1);
      expect(result[0]).toBe(mockParser);
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
      vi.mocked(mockGenerator.generate).mockReturnValue(
        mockGeneratorOutput({ content: 'test-content' }),
      );

      const mockMetadata = createMockMetadataPort();
      vi.mocked(mockMetadata.getMetadata).mockResolvedValue(undefined);

      const parsers = new Map<string, ParserPort>([['.note', mockParser]]);
      const service = new PetrifyService(
        parsers,
        mockGenerator,
        null,
        mockMetadata,
        { confidenceThreshold: 50 },
      );

      const event: FileChangeEvent = {
        id: '/path/to/file.note',
        name: 'file.note',
        extension: '.note',
        mtime: 2000,
        readData: vi.fn<() => Promise<ArrayBuffer>>().mockResolvedValue(new ArrayBuffer(8)),
      };

      const result = await service.handleFileChange(event);

      expect(result).not.toBeNull();
      expect(result!.content).toBe('test-content');
      expect(result!.metadata).toEqual({
        source: event.id,
        mtime: event.mtime,
      });
    });

    it('OCR 포함 변환', async () => {
      const mockParser = createMockParserPort();
      const note = createTestNote();
      vi.mocked(mockParser.parse).mockResolvedValue(note);

      const mockGenerator = createMockGeneratorPort();
      vi.mocked(mockGenerator.generate).mockReturnValue(
        mockGeneratorOutput({ content: 'test-content' }),
      );

      const mockMetadata = createMockMetadataPort();
      vi.mocked(mockMetadata.getMetadata).mockResolvedValue(undefined);

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
        { confidenceThreshold: 50 },
      );

      const event: FileChangeEvent = {
        id: '/path/to/file.note',
        name: 'file.note',
        extension: '.note',
        mtime: 2000,
        readData: vi.fn<() => Promise<ArrayBuffer>>().mockResolvedValue(new ArrayBuffer(8)),
      };

      await service.handleFileChange(event);

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
      vi.mocked(mockGenerator.generate).mockReturnValue(
        mockGeneratorOutput({ content: 'test-content' }),
      );

      const mockMetadata = createMockMetadataPort();
      vi.mocked(mockMetadata.getMetadata).mockResolvedValue(undefined);
      vi.mocked(mockMetadata.formatMetadata).mockReturnValue('');

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
        { confidenceThreshold: 50 },
      );

      const event: FileChangeEvent = {
        id: '/path/to/file.note',
        name: 'file.note',
        extension: '.note',
        mtime: 2000,
        readData: vi.fn<() => Promise<ArrayBuffer>>().mockResolvedValue(new ArrayBuffer(8)),
      };

      await service.handleFileChange(event);

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

      const parsers = new Map<string, ParserPort>([['.note', mockParser]]);
      const service = new PetrifyService(
        parsers,
        mockGenerator,
        null,
        mockMetadata,
        { confidenceThreshold: 50 },
      );

      const event: FileChangeEvent = {
        id: '/path/to/file.note',
        name: 'file.note',
        extension: '.note',
        mtime: 2000,
        readData: vi.fn<() => Promise<ArrayBuffer>>().mockResolvedValue(new ArrayBuffer(8)),
      };

      const result = await service.handleFileChange(event);

      expect(result).not.toBeNull();
      expect(result!.assets.get('img.png')).toEqual(new Uint8Array([1, 2, 3]));
    });

    it('다중 페이지 OCR — 페이지별 OCR 수행', async () => {
      const page1 = createTestPage({ id: 'page-1', order: 0 });
      const page2 = createTestPage({ id: 'page-2', order: 1, imageData: new Uint8Array([4, 5, 6]) });
      const note = createTestNote({ pages: [page1, page2] });

      const mockParser = createMockParserPort();
      vi.mocked(mockParser.parse).mockResolvedValue(note);

      const mockGenerator = createMockGeneratorPort();
      vi.mocked(mockGenerator.generate).mockReturnValue(
        mockGeneratorOutput({ content: 'test-content' }),
      );

      const mockMetadata = createMockMetadataPort();
      vi.mocked(mockMetadata.getMetadata).mockResolvedValue(undefined);

      const mockOcr = createMockOcrPort();
      vi.mocked(mockOcr.recognize)
        .mockResolvedValueOnce({
          text: 'page1-text',
          confidence: 90,
          regions: [{ text: 'page1-text', confidence: 90, x: 0, y: 0, width: 50, height: 20 }],
        })
        .mockResolvedValueOnce({
          text: 'page2-text',
          confidence: 85,
          regions: [{ text: 'page2-text', confidence: 85, x: 0, y: 0, width: 50, height: 20 }],
        });

      const parsers = new Map<string, ParserPort>([['.note', mockParser]]);
      const service = new PetrifyService(
        parsers,
        mockGenerator,
        mockOcr,
        mockMetadata,
        { confidenceThreshold: 50 },
      );

      const event: FileChangeEvent = {
        id: '/path/to/file.note',
        name: 'file.note',
        extension: '.note',
        mtime: 2000,
        readData: vi.fn<() => Promise<ArrayBuffer>>().mockResolvedValue(new ArrayBuffer(8)),
      };

      await service.handleFileChange(event);

      expect(mockOcr.recognize).toHaveBeenCalledTimes(2);
      const generateCall = vi.mocked(mockGenerator.generate).mock.calls[0];
      const ocrResults = generateCall[2];
      expect(ocrResults).toHaveLength(2);
      expect(ocrResults![0].texts).toContain('page1-text');
      expect(ocrResults![1].texts).toContain('page2-text');
    });

    it('빈 imageData 페이지는 OCR 건너뜀', async () => {
      const emptyPage = createTestPage({ id: 'empty-page', order: 0, imageData: new Uint8Array([]) });
      const normalPage = createTestPage({ id: 'normal-page', order: 1 });
      const note = createTestNote({ pages: [emptyPage, normalPage] });

      const mockParser = createMockParserPort();
      vi.mocked(mockParser.parse).mockResolvedValue(note);

      const mockGenerator = createMockGeneratorPort();
      vi.mocked(mockGenerator.generate).mockReturnValue(
        mockGeneratorOutput({ content: 'test-content' }),
      );

      const mockMetadata = createMockMetadataPort();
      vi.mocked(mockMetadata.getMetadata).mockResolvedValue(undefined);

      const mockOcr = createMockOcrPort();
      vi.mocked(mockOcr.recognize).mockResolvedValue({
        text: 'normal-text',
        confidence: 90,
        regions: [{ text: 'normal-text', confidence: 90, x: 0, y: 0, width: 50, height: 20 }],
      });

      const parsers = new Map<string, ParserPort>([['.note', mockParser]]);
      const service = new PetrifyService(
        parsers,
        mockGenerator,
        mockOcr,
        mockMetadata,
        { confidenceThreshold: 50 },
      );

      const event: FileChangeEvent = {
        id: '/path/to/file.note',
        name: 'file.note',
        extension: '.note',
        mtime: 2000,
        readData: vi.fn<() => Promise<ArrayBuffer>>().mockResolvedValue(new ArrayBuffer(8)),
      };

      await service.handleFileChange(event);

      expect(mockOcr.recognize).toHaveBeenCalledTimes(1);
    });

    it('convertDroppedFile 플로우', async () => {
      const mockParser = createMockParserPort();
      const note = createTestNote();
      vi.mocked(mockParser.parse).mockResolvedValue(note);

      const mockGenerator = createMockGeneratorPort();
      vi.mocked(mockGenerator.generate).mockReturnValue(
        mockGeneratorOutput({ content: 'dropped-content' }),
      );

      const mockMetadata = createMockMetadataPort();

      const service = new PetrifyService(
        new Map(),
        mockGenerator,
        null,
        mockMetadata,
        { confidenceThreshold: 50 },
      );

      const data = new ArrayBuffer(8);
      const result = await service.convertDroppedFile(data, mockParser, 'dropped');

      expect(result.content).toBe('dropped-content');
      expect(result.metadata).toEqual({
        source: null,
        mtime: null,
        keep: true,
      });
      expect(mockParser.parse).toHaveBeenCalledWith(data);
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
        { confidenceThreshold: 50 },
      );

      const event: FileChangeEvent = {
        id: '/path/to/file.note',
        name: 'file.note',
        extension: '.note',
        mtime: 2000,
        readData: vi.fn<() => Promise<ArrayBuffer>>().mockResolvedValue(new ArrayBuffer(8)),
      };

      await expect(service.handleFileChange(event)).rejects.toThrow(ConversionError);
      await expect(service.handleFileChange(event)).rejects.toMatchObject({
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
        { confidenceThreshold: 50 },
      );

      const event: FileChangeEvent = {
        id: '/path/to/file.note',
        name: 'file.note',
        extension: '.note',
        mtime: 2000,
        readData: vi.fn<() => Promise<ArrayBuffer>>().mockResolvedValue(new ArrayBuffer(8)),
      };

      await expect(service.handleFileChange(event)).rejects.toThrow(ConversionError);
      await expect(service.handleFileChange(event)).rejects.toMatchObject({
        phase: 'ocr',
      });
    });

    it('generate 실패 시 ConversionError (phase=generate)', async () => {
      const mockParser = createMockParserPort();
      const note = createTestNote();
      vi.mocked(mockParser.parse).mockResolvedValue(note);

      const mockGenerator = createMockGeneratorPort();
      vi.mocked(mockGenerator.generate).mockImplementation(() => {
        throw new Error('generation failed');
      });

      const mockMetadata = createMockMetadataPort();
      vi.mocked(mockMetadata.getMetadata).mockResolvedValue(undefined);

      const parsers = new Map<string, ParserPort>([['.note', mockParser]]);
      const service = new PetrifyService(
        parsers,
        mockGenerator,
        null,
        mockMetadata,
        { confidenceThreshold: 50 },
      );

      const event: FileChangeEvent = {
        id: '/path/to/file.note',
        name: 'file.note',
        extension: '.note',
        mtime: 2000,
        readData: vi.fn<() => Promise<ArrayBuffer>>().mockResolvedValue(new ArrayBuffer(8)),
      };

      await expect(service.handleFileChange(event)).rejects.toThrow(ConversionError);
      await expect(service.handleFileChange(event)).rejects.toMatchObject({
        phase: 'generate',
      });
    });
  });
});
