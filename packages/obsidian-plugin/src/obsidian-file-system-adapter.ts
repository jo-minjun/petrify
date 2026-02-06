import * as path from 'path';
import type { App } from 'obsidian';
import { FileSystemError } from '@petrify/core';
import type { FileSystemPort } from '@petrify/core';

export class ObsidianFileSystemAdapter implements FileSystemPort {
  constructor(private readonly app: App) {}

  async writeFile(filePath: string, content: string): Promise<void> {
    try {
      const dir = path.dirname(filePath);
      if (!(await this.app.vault.adapter.exists(dir))) {
        await this.app.vault.adapter.mkdir(dir);
      }
      await this.app.vault.adapter.write(filePath, content);
    } catch (error) {
      throw new FileSystemError('write', filePath, error);
    }
  }

  async writeAsset(dir: string, name: string, data: Uint8Array): Promise<string> {
    const assetPath = path.join(dir, name);
    try {
      if (!(await this.app.vault.adapter.exists(dir))) {
        await this.app.vault.adapter.mkdir(dir);
      }
      await this.app.vault.adapter.writeBinary(assetPath, data.buffer as ArrayBuffer);
      return assetPath;
    } catch (error) {
      throw new FileSystemError('write', assetPath, error);
    }
  }

  async exists(filePath: string): Promise<boolean> {
    try {
      return await this.app.vault.adapter.exists(filePath);
    } catch {
      return false;
    }
  }
}
