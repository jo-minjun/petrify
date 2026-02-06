import { describe, it, expect, vi } from 'vitest';
import { PetrifyService } from '../src/petrify-service.js';
import type { ParserPort } from '../src/ports/parser.js';
import type { FileGeneratorPort } from '../src/ports/file-generator.js';
import type { ConversionMetadataPort } from '../src/ports/conversion-metadata.js';
import type { FileSystemPort } from '../src/ports/file-system.js';
import type { FileChangeEvent } from '../src/ports/watcher.js';

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
});
