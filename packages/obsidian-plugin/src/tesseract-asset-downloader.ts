import * as path from 'node:path';

export interface AssetFs {
  exists(filePath: string): Promise<boolean>;
  mkdir(dirPath: string): Promise<void>;
  writeFile(filePath: string, data: ArrayBuffer): Promise<void>;
}

export interface AssetHttp {
  download(url: string): Promise<ArrayBuffer>;
}

const REPO = 'jo-minjun/petrify';

const TESSERACT_FILES = [
  'worker.min.js',
  'tesseract-core/index.js',
  'tesseract-core/tesseract-core-lstm.js',
  'tesseract-core/tesseract-core-lstm.wasm',
  'tesseract-core/tesseract-core-lstm.wasm.js',
  'tesseract-core/tesseract-core-simd-lstm.js',
  'tesseract-core/tesseract-core-simd-lstm.wasm',
  'tesseract-core/tesseract-core-simd-lstm.wasm.js',
];

export class TesseractAssetDownloader {
  constructor(
    private readonly fs: AssetFs,
    private readonly http: AssetHttp,
  ) {}

  async ensureAssets(
    pluginDir: string,
    version: string,
    onProgress?: (current: number, total: number) => void,
  ): Promise<'skipped' | 'downloaded'> {
    const workerExists = await this.fs.exists(path.join(pluginDir, 'worker.min.js'));
    const coreExists = await this.fs.exists(path.join(pluginDir, 'tesseract-core'));

    if (workerExists && coreExists) {
      return 'skipped';
    }

    await this.fs.mkdir(path.join(pluginDir, 'tesseract-core'));

    const baseUrl = `https://github.com/${REPO}/releases/download/${version}`;
    const total = TESSERACT_FILES.length;

    for (let i = 0; i < total; i++) {
      const file = TESSERACT_FILES[i];
      const url = `${baseUrl}/${file.replace('/', '--')}`;
      const data = await this.http.download(url);
      await this.fs.writeFile(path.join(pluginDir, file), data);
      onProgress?.(i + 1, total);
    }

    return 'downloaded';
  }
}
