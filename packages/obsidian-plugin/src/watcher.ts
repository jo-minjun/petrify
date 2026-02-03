import chokidar, { type FSWatcher } from 'chokidar';
import * as path from 'path';

export interface WatcherCallbacks {
  onFileChange: (filePath: string, mtime: number) => Promise<void>;
  onError: (error: Error, filePath?: string) => void;
}

export class PetrifyWatcher {
  private readonly watchers: Map<string, FSWatcher> = new Map();
  private readonly supportedExtensions: string[];
  private readonly callbacks: WatcherCallbacks;

  constructor(supportedExtensions: string[], callbacks: WatcherCallbacks) {
    this.supportedExtensions = supportedExtensions.map((ext) => ext.toLowerCase());
    this.callbacks = callbacks;
  }

  getSupportedExtensions(): string[] {
    return this.supportedExtensions;
  }

  isSupported(filePath: string): boolean {
    const ext = path.extname(filePath).toLowerCase();
    return this.supportedExtensions.includes(ext);
  }

  getWatchedDirs(): string[] {
    return Array.from(this.watchers.keys());
  }

  async watch(dir: string): Promise<void> {
    if (this.watchers.has(dir)) {
      return;
    }

    const watcher = chokidar.watch(dir, {
      persistent: true,
      ignoreInitial: false,
      alwaysStat: true,
      depth: 0,
    });

    watcher.on('add', (filePath, stats) => this.handleFileEvent(filePath, stats));
    watcher.on('change', (filePath, stats) => this.handleFileEvent(filePath, stats));
    watcher.on('error', (error: unknown) => {
      const err = error instanceof Error ? error : new Error(String(error));
      this.callbacks.onError(err);
    });

    this.watchers.set(dir, watcher);
  }

  private async handleFileEvent(
    filePath: string,
    stats: { mtimeMs: number } | undefined
  ): Promise<void> {
    if (!this.isSupported(filePath)) {
      return;
    }

    const mtime = stats?.mtimeMs ?? Date.now();

    try {
      await this.callbacks.onFileChange(filePath, mtime);
    } catch (error) {
      this.callbacks.onError(error as Error, filePath);
    }
  }

  async unwatch(dir: string): Promise<void> {
    const watcher = this.watchers.get(dir);
    if (watcher) {
      await watcher.close();
      this.watchers.delete(dir);
    }
  }

  async close(): Promise<void> {
    const promises = Array.from(this.watchers.values()).map((w) => w.close());
    await Promise.all(promises);
    this.watchers.clear();
  }
}
