import { describe, it, expect, beforeEach } from 'vitest';
import type { ParserPort, OcrPort, Note, OcrResult } from '@petrify/core';
import { Converter } from '../src/converter.js';
import { ParserRegistry } from '../src/parser-registry.js';

class MockParser implements ParserPort {
  readonly extensions = ['.note'];
  async parse(_data: ArrayBuffer): Promise<Note> {
    return {
      title: 'test',
      pages: [
        {
          id: 'page-1',
          width: 100,
          height: 100,
          strokes: [],
        },
      ],
      createdAt: new Date(),
      modifiedAt: new Date(),
    };
  }
}

class MockOcr implements OcrPort {
  async recognize(_image: ArrayBuffer): Promise<OcrResult> {
    return {
      text: 'test',
      regions: [{ text: 'test', x: 0, y: 0, width: 10, height: 10, confidence: 90 }],
    };
  }
}

describe('Converter', () => {
  let converter: Converter;
  let registry: ParserRegistry;
  let mockOcr: MockOcr;

  beforeEach(() => {
    registry = new ParserRegistry();
    registry.register(new MockParser());
    mockOcr = new MockOcr();
    converter = new Converter(registry, mockOcr, { confidenceThreshold: 50 });
  });

  it('지원하는 확장자의 파일을 변환한다', async () => {
    const data = new ArrayBuffer(0);
    const result = await converter.convert(data, '.note', {
      sourcePath: '/path/to/file.note',
      mtime: 1705315800000,
    });

    expect(result).toContain('petrify:');
    expect(result).toContain('source: /path/to/file.note');
    expect(result).toContain('mtime: 1705315800000');
    expect(result).toContain('excalidraw-plugin: parsed');
  });

  it('지원하지 않는 확장자는 에러를 던진다', async () => {
    const data = new ArrayBuffer(0);

    await expect(
      converter.convert(data, '.unknown', {
        sourcePath: '/path/to/file.unknown',
        mtime: 1705315800000,
      })
    ).rejects.toThrow('Unsupported file extension: .unknown');
  });
});
