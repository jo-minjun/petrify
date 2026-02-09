import { describe, expect, it, vi } from 'vitest';
import { TesseractAssetDownloader } from '../src/tesseract-assets.js';

function createMockFs(existingFiles: Set<string> = new Set()) {
  return {
    exists: vi.fn((p: string) => Promise.resolve(existingFiles.has(p))),
    mkdir: vi.fn(() => Promise.resolve()),
    writeFile: vi.fn(() => Promise.resolve()),
  };
}

function createMockHttp() {
  return {
    download: vi.fn(() => Promise.resolve(new ArrayBuffer(8))),
  };
}

describe('TesseractAssetDownloader', () => {
  const pluginDir = '/vault/.obsidian/plugins/petrify';
  const version = '0.1.0';

  const allFiles = [
    'worker.min.js',
    'tesseract-core/index.js',
    'tesseract-core/tesseract-core-lstm.js',
    'tesseract-core/tesseract-core-lstm.wasm',
    'tesseract-core/tesseract-core-lstm.wasm.js',
    'tesseract-core/tesseract-core-simd-lstm.js',
    'tesseract-core/tesseract-core-simd-lstm.wasm',
    'tesseract-core/tesseract-core-simd-lstm.wasm.js',
    'tesseract-core/tesseract-core-relaxedsimd-lstm.js',
    'tesseract-core/tesseract-core-relaxedsimd-lstm.wasm',
    'tesseract-core/tesseract-core-relaxedsimd-lstm.wasm.js',
  ].map((f) => `${pluginDir}/${f}`);

  it('skips download when all assets already exist', async () => {
    const fs = createMockFs(new Set(allFiles));
    const http = createMockHttp();

    const downloader = new TesseractAssetDownloader(fs, http);
    const result = await downloader.ensureAssets(pluginDir, version);

    expect(result).toBe('skipped');
    expect(http.download).not.toHaveBeenCalled();
  });

  it('downloads when only some assets exist', async () => {
    const partialFiles = new Set([`${pluginDir}/worker.min.js`]);
    const fs = createMockFs(partialFiles);
    const http = createMockHttp();

    const downloader = new TesseractAssetDownloader(fs, http);
    const result = await downloader.ensureAssets(pluginDir, version);

    expect(result).toBe('downloaded');
    expect(http.download).toHaveBeenCalledTimes(11);
  });

  it('downloads all files when no assets exist', async () => {
    const fs = createMockFs();
    const http = createMockHttp();

    const downloader = new TesseractAssetDownloader(fs, http);
    const result = await downloader.ensureAssets(pluginDir, version);

    expect(result).toBe('downloaded');
    expect(http.download).toHaveBeenCalledTimes(11);
    expect(http.download).toHaveBeenCalledWith(expect.stringContaining('worker.min.js'));
    expect(fs.mkdir).toHaveBeenCalledWith(`${pluginDir}/tesseract-core`);
  });

  it('invokes the progress callback', async () => {
    const fs = createMockFs();
    const http = createMockHttp();
    const onProgress = vi.fn();

    const downloader = new TesseractAssetDownloader(fs, http);
    await downloader.ensureAssets(pluginDir, version, onProgress);

    expect(onProgress).toHaveBeenCalledTimes(11);
    expect(onProgress).toHaveBeenLastCalledWith(11, 11);
  });

  it('throws an error when download fails', async () => {
    const fs = createMockFs();
    const http = createMockHttp();
    http.download.mockRejectedValue(new Error('Network error'));

    const downloader = new TesseractAssetDownloader(fs, http);
    await expect(downloader.ensureAssets(pluginDir, version)).rejects.toThrow('Network error');
  });
});
