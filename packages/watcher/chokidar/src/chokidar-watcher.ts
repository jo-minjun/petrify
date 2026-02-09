import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import type { FileChangeEvent, FileDeleteEvent, WatcherPort } from '@petrify/core';
import type { FSWatcher } from 'chokidar';
import { watch } from 'chokidar';

function normalizeError(error: unknown): Error {
  return error instanceof Error ? error : new Error(String(error));
}

function fileMetadata(filePath: string): { id: string; name: string; extension: string } {
  return {
    id: filePath,
    name: path.basename(filePath),
    extension: path.extname(filePath).toLowerCase(),
  };
}

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

  start(): Promise<void> {
    this.watcher = watch(this.dir, {
      persistent: true,
      ignoreInitial: false,
      alwaysStat: true,
      depth: 0,
    });

    const fileEventHandler = (filePath: string, stats?: { mtimeMs: number }): void => {
      void this.handleFileEvent(filePath, stats);
    };
    this.watcher.on('add', fileEventHandler);
    this.watcher.on('change', fileEventHandler);
    this.watcher.on('unlink', (filePath: string) => {
      void this.handleDeleteEvent(filePath);
    });
    this.watcher.on('error', (error: unknown) => {
      this.errorHandler?.(normalizeError(error));
    });

    return Promise.resolve();
  }

  async stop(): Promise<void> {
    await this.watcher?.close();
    this.watcher = null;
  }

  private async handleFileEvent(
    filePath: string,
    stats: { mtimeMs: number } | undefined,
  ): Promise<void> {
    const meta = fileMetadata(filePath);
    const mtime = stats?.mtimeMs ?? Date.now();

    const event: FileChangeEvent = {
      ...meta,
      mtime,
      readData: () =>
        fs.readFile(filePath).then((buf) => {
          const ab = new ArrayBuffer(buf.byteLength);
          new Uint8Array(ab).set(buf);
          return ab;
        }),
    };

    try {
      await this.fileHandler?.(event);
    } catch (error) {
      this.errorHandler?.(normalizeError(error));
    }
  }

  private async handleDeleteEvent(filePath: string): Promise<void> {
    const event: FileDeleteEvent = fileMetadata(filePath);

    try {
      await this.deleteHandler?.(event);
    } catch (error) {
      this.errorHandler?.(normalizeError(error));
    }
  }
}
