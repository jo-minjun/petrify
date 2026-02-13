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
    metadata: { source: '/watch/file.note', parser: null, fileHash: null, pageHashes: null },
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

  it('combines frontmatter + content and saves to the correct path', async () => {
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

  it('saves to the assets directory when assets are present', async () => {
    const assetData = new Uint8Array([1, 2, 3]);
    const result = createResult({
      assets: new Map([['image.png', assetData]]),
    });

    await saveConversionResult(result, 'output', 'file', '.excalidraw.md', writer, formatter);

    expect(writer.writeAsset).toHaveBeenCalledWith('output/assets/file', 'image.png', assetData);
  });

  it('saves all multiple assets', async () => {
    const result = createResult({
      assets: new Map([
        ['img1.png', new Uint8Array([1])],
        ['img2.png', new Uint8Array([2])],
      ]),
    });

    await saveConversionResult(result, 'output', 'file', '.excalidraw.md', writer, formatter);

    expect(writer.writeAsset).toHaveBeenCalledTimes(2);
  });

  it('does not call writeAsset when assets are empty', async () => {
    const result = createResult({ assets: new Map() });

    await saveConversionResult(result, 'output', 'file', '.excalidraw.md', writer, formatter);

    expect(writer.writeAsset).not.toHaveBeenCalled();
  });

  it('throws ConversionError(save) when writeFile fails', async () => {
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

  it('rethrows as-is when it is already a ConversionError', async () => {
    const original = new ConversionError('generate', new Error('template'));
    writer.writeFile.mockRejectedValue(original);
    const result = createResult();

    await expect(
      saveConversionResult(result, 'output', 'file', '.excalidraw.md', writer, formatter),
    ).rejects.toBe(original);
  });

  it('generates path with filename only when outputDir is empty string (vault root)', async () => {
    const result = createResult();

    const outputPath = await saveConversionResult(
      result,
      '',
      'file',
      '.excalidraw.md',
      writer,
      formatter,
    );

    expect(outputPath).toBe('file.excalidraw.md');
    expect(writer.writeFile).toHaveBeenCalledWith(
      'file.excalidraw.md',
      '---\nsource: test\n---\n# Test Content',
    );
  });

  it('generates correct assets path when outputDir is empty string', async () => {
    const assetData = new Uint8Array([1, 2, 3]);
    const result = createResult({
      assets: new Map([['image.png', assetData]]),
    });

    await saveConversionResult(result, '', 'file', '.excalidraw.md', writer, formatter);

    expect(writer.writeAsset).toHaveBeenCalledWith('assets/file', 'image.png', assetData);
  });

  it('generates correct path with markdown extension', async () => {
    const result = createResult();

    const outputPath = await saveConversionResult(result, 'notes', 'doc', '.md', writer, formatter);

    expect(outputPath).toBe('notes/doc.md');
  });
});
