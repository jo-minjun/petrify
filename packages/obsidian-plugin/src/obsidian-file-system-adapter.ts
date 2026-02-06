import * as path from 'path';
import type { App } from 'obsidian';
import type { FileSystemPort } from '@petrify/core';

export class ObsidianFileSystemAdapter implements FileSystemPort {
  constructor(private readonly app: App) {}

  async writeFile(filePath: string, content: string): Promise<void> {
    const dir = path.dirname(filePath);
    if (!(await this.app.vault.adapter.exists(dir))) {
      await this.app.vault.adapter.mkdir(dir);
    }
    await this.app.vault.adapter.write(filePath, content);
  }

  async writeAsset(dir: string, name: string, data: Uint8Array): Promise<string> {
    if (!(await this.app.vault.adapter.exists(dir))) {
      await this.app.vault.adapter.mkdir(dir);
    }
    const assetPath = path.join(dir, name);
    await this.app.vault.adapter.writeBinary(assetPath, data.buffer as ArrayBuffer);
    return assetPath;
  }

  async exists(filePath: string): Promise<boolean> {
    return this.app.vault.adapter.exists(filePath);
  }
}
