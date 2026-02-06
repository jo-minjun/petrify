import type { ConversionResult } from '@petrify/core';
import { ConversionError } from '@petrify/core';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { FileWriter, MetadataFormatter } from '../src/conversion-saver.js';
import { saveConversionResult } from '../src/conversion-saver.js';

vi.mock('obsidian', () => ({
  Notice: vi.fn(),
}));

function createMockFileWriter(): { [K in keyof FileWriter]: ReturnType<typeof vi.fn> } {
  return {
    writeFile: vi.fn(),
    writeAsset: vi.fn(),
  };
}

function createMockMetadataFormatter(): {
  [K in keyof MetadataFormatter]: ReturnType<typeof vi.fn>;
} {
  return {
    formatMetadata: vi.fn().mockReturnValue('---\nsource: test\n---\n'),
  };
}

function createResult(overrides?: Partial<ConversionResult>): ConversionResult {
  return {
    content: '# Test Content',
    assets: new Map(),
    metadata: { source: '/watch/file.note', mtime: 1000 },
    ...overrides,
  };
}

describe('saveConversionResult', () => {
  let writer: ReturnType<typeof createMockFileWriter>;
  let formatter: ReturnType<typeof createMockMetadataFormatter>;

  beforeEach(() => {
    writer = createMockFileWriter();
    formatter = createMockMetadataFormatter();
  });

  it('frontmatter + content를 결합하여 올바른 경로에 저장', async () => {
    const result = createResult();

    const outputPath = await saveConversionResult(
      result,
      'output',
      'file',
      '.excalidraw.md',
      writer,
      formatter,
    );

    expect(outputPath).toBe('output/file.excalidraw.md');
    expect(writer.writeFile).toHaveBeenCalledWith(
      'output/file.excalidraw.md',
      '---\nsource: test\n---\n# Test Content',
    );
  });

  it('assets가 있으면 assets 디렉토리에 저장', async () => {
    const assetData = new Uint8Array([1, 2, 3]);
    const result = createResult({
      assets: new Map([['image.png', assetData]]),
    });

    await saveConversionResult(result, 'output', 'file', '.excalidraw.md', writer, formatter);

    expect(writer.writeAsset).toHaveBeenCalledWith('output/assets/file', 'image.png', assetData);
  });

  it('여러 assets를 모두 저장', async () => {
    const result = createResult({
      assets: new Map([
        ['img1.png', new Uint8Array([1])],
        ['img2.png', new Uint8Array([2])],
      ]),
    });

    await saveConversionResult(result, 'output', 'file', '.excalidraw.md', writer, formatter);

    expect(writer.writeAsset).toHaveBeenCalledTimes(2);
  });

  it('assets가 비어있으면 writeAsset 호출 안 함', async () => {
    const result = createResult({ assets: new Map() });

    await saveConversionResult(result, 'output', 'file', '.excalidraw.md', writer, formatter);

    expect(writer.writeAsset).not.toHaveBeenCalled();
  });

  it('writeFile 실패 시 ConversionError(save)를 throw', async () => {
    writer.writeFile.mockRejectedValue(new Error('ENOSPC'));
    const result = createResult();

    const error = await saveConversionResult(
      result,
      'output',
      'file',
      '.excalidraw.md',
      writer,
      formatter,
    ).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(ConversionError);
    expect((error as ConversionError).phase).toBe('save');
  });

  it('이미 ConversionError이면 그대로 rethrow', async () => {
    const original = new ConversionError('generate', new Error('template'));
    writer.writeFile.mockRejectedValue(original);
    const result = createResult();

    await expect(
      saveConversionResult(result, 'output', 'file', '.excalidraw.md', writer, formatter),
    ).rejects.toBe(original);
  });

  it('markdown 확장자로도 올바른 경로 생성', async () => {
    const result = createResult();

    const outputPath = await saveConversionResult(result, 'notes', 'doc', '.md', writer, formatter);

    expect(outputPath).toBe('notes/doc.md');
  });
});
