import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import type { FileChangeEvent, FileDeleteEvent, WatcherPort } from '@petrify/core';
import type { FSWatcher } from 'chokidar';
import { watch } from 'chokidar';

export class ChokidarWatcher implements WatcherPort {
  private watcher: FSWatcher | null = null;
  private fileHandler: ((event: FileChangeEvent) => Promise<void>) | null = null;
  private deleteHandler: ((event: FileDeleteEvent) => Promise<void>) | null = null;
  private errorHandler: ((error: Error) => void) | null = null;

  constructor(private readonly dir: string) {}

  onFileChange(handler: (event: FileChangeEvent) => Promise<void>): void {
    this.fileHandler = handler;
  }

  onFileDelete(handler: (event: FileDeleteEvent) => Promise<void>): void {
    this.deleteHandler = handler;
  }

  onError(handler: (error: Error) => void): void {
    this.errorHandler = handler;
  }

  async start(): Promise<void> {
    this.watcher = watch(this.dir, {
      persistent: true,
      ignoreInitial: false,
      alwaysStat: true,
      depth: 0,
    });

    this.watcher.on('add', (filePath, stats) => this.handleFileEvent(filePath, stats));
    this.watcher.on('change', (filePath, stats) => this.handleFileEvent(filePath, stats));
    this.watcher.on('unlink', (filePath) => this.handleDeleteEvent(filePath));
    this.watcher.on('error', (error: unknown) => {
      const err = error instanceof Error ? error : new Error(String(error));
      this.errorHandler?.(err);
    });
  }

  async stop(): Promise<void> {
    await this.watcher?.close();
    this.watcher = null;
  }

  private async handleFileEvent(
    filePath: string,
    stats: { mtimeMs: number } | undefined,
  ): Promise<void> {
    const mtime = stats?.mtimeMs ?? Date.now();

    const event: FileChangeEvent = {
      id: filePath,
      name: path.basename(filePath),
      extension: path.extname(filePath).toLowerCase(),
      mtime,
      readData: () => fs.readFile(filePath).then((buf) => buf.buffer as ArrayBuffer),
    };

    try {
      await this.fileHandler?.(event);
    } catch (error) {
      this.errorHandler?.(error as Error);
    }
  }

  private async handleDeleteEvent(filePath: string): Promise<void> {
    const event: FileDeleteEvent = {
      id: filePath,
      name: path.basename(filePath),
      extension: path.extname(filePath).toLowerCase(),
    };

    try {
      await this.deleteHandler?.(event);
    } catch (error) {
      this.errorHandler?.(error as Error);
    }
  }
}
