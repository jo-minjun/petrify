import * as path from 'node:path';
import type { App } from 'obsidian';
import { normalizePath } from 'obsidian';

export class ObsidianFileSystemAdapter {
  constructor(private readonly app: App) {}

  async writeFile(filePath: string, content: string): Promise<void> {
    const normalized = normalizePath(filePath);
    const dir = path.dirname(normalized);
    if (!(await this.app.vault.adapter.exists(dir))) {
      await this.app.vault.adapter.mkdir(dir);
    }
    await this.app.vault.adapter.write(normalized, content);
  }

  async writeAsset(dir: string, name: string, data: Uint8Array): Promise<void> {
    const normalizedDir = normalizePath(dir);
    if (!(await this.app.vault.adapter.exists(normalizedDir))) {
      await this.app.vault.adapter.mkdir(normalizedDir);
    }
    const assetPath = normalizePath(path.join(normalizedDir, name));
    await this.app.vault.adapter.writeBinary(assetPath, data.buffer as ArrayBuffer);
  }
}
