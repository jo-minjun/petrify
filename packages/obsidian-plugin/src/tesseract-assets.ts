import * as fs from 'node:fs';
import * as http from 'node:http';
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
  'tesseract-core/tesseract-core-relaxedsimd-lstm.js',
  'tesseract-core/tesseract-core-relaxedsimd-lstm.wasm',
  'tesseract-core/tesseract-core-relaxedsimd-lstm.wasm.js',
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
    const fileChecks = TESSERACT_FILES.map((file) => this.fs.exists(path.join(pluginDir, file)));
    const allFilesPresent = (await Promise.all(fileChecks)).every(Boolean);

    if (allFilesPresent) {
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

const MIME_TYPES: Record<string, string> = {
  '.js': 'application/javascript',
  '.wasm': 'application/wasm',
};

/**
 * Serves tesseract-core files via local HTTP.
 * Blob URL Workers block file:// access, so this bypasses the restriction via localhost.
 */
export class TesseractAssetServer {
  private server: http.Server | null = null;
  private port = 0;

  constructor(private readonly baseDir: string) {}

  async start(): Promise<string> {
    return new Promise((resolve, reject) => {
      this.server = http.createServer((req, res) => {
        const safePath = path.normalize(req.url ?? '/').replace(/^(\.\.[/\\])+/, '');
        const filePath = path.join(this.baseDir, safePath);

        if (!filePath.startsWith(this.baseDir)) {
          res.writeHead(403);
          res.end();
          return;
        }

        const ext = path.extname(filePath);
        const contentType = MIME_TYPES[ext] ?? 'application/octet-stream';

        try {
          const data = fs.readFileSync(filePath);
          res.writeHead(200, {
            'Content-Type': contentType,
            'Access-Control-Allow-Origin': '*',
          });
          res.end(data);
        } catch {
          res.writeHead(404);
          res.end();
        }
      });

      this.server.listen(0, '127.0.0.1', () => {
        const addr = this.server?.address();
        if (addr && typeof addr === 'object') {
          this.port = addr.port;
          resolve(`http://127.0.0.1:${this.port}/`);
        } else {
          reject(new Error('Failed to start asset server'));
        }
      });

      this.server.on('error', reject);
    });
  }

  stop(): void {
    this.server?.close();
    this.server = null;
  }
}
