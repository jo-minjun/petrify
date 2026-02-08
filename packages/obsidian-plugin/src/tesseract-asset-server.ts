import * as fs from 'node:fs';
import * as http from 'node:http';
import * as path from 'node:path';

const MIME_TYPES: Record<string, string> = {
  '.js': 'application/javascript',
  '.wasm': 'application/wasm',
};

/**
 * tesseract-core 파일을 로컬 HTTP로 서빙한다.
 * Blob URL Worker에서 file:// 접근이 차단되므로, localhost로 우회.
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
