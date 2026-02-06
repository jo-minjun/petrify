import * as path from 'node:path';
import type { App } from 'obsidian';

export class ObsidianFileSystemAdapter {
  constructor(private readonly app: App) {}

  async writeFile(filePath: string, content: string): Promise<void> {
    const dir = path.dirname(filePath);
    if (!(await this.app.vault.adapter.exists(dir))) {
      await this.app.vault.adapter.mkdir(dir);
    }
    await this.app.vault.adapter.write(filePath, content);
  }

  async writeAsset(dir: string, name: string, data: Uint8Array): Promise<void> {
    if (!(await this.app.vault.adapter.exists(dir))) {
      await this.app.vault.adapter.mkdir(dir);
    }
    const assetPath = path.join(dir, name);
    await this.app.vault.adapter.writeBinary(assetPath, data.buffer as ArrayBuffer);
  }
}
