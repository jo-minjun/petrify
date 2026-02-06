import * as path from 'path';
import type { WatcherPort, FileChangeEvent, FileDeleteEvent } from '@petrify/core';
import { GoogleDriveClient } from './google-drive-client.js';
import type { GoogleDriveWatcherOptions, DriveFile } from './types.js';

export class GoogleDriveWatcher implements WatcherPort {
  private readonly client: GoogleDriveClient;
  private readonly folderId: string;
  private readonly pollIntervalMs: number;
  private readonly pageTokenStore: GoogleDriveWatcherOptions['pageTokenStore'];
  private readonly fileCache = new Map<string, { name: string; extension: string }>();

  private fileHandler: ((event: FileChangeEvent) => Promise<void>) | null = null;
  private deleteHandler: ((event: FileDeleteEvent) => Promise<void>) | null = null;
  private errorHandler: ((error: Error) => void) | null = null;
  private pollTimer: ReturnType<typeof setInterval> | null = null;
  private pageToken: string | null = null;

  constructor(options: GoogleDriveWatcherOptions) {
    this.client = new GoogleDriveClient(options.auth);
    this.folderId = options.folderId;
    this.pollIntervalMs = options.pollIntervalMs;
    this.pageTokenStore = options.pageTokenStore;
  }

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
    this.pageToken = await this.pageTokenStore.loadPageToken();

    if (!this.pageToken) {
      this.pageToken = await this.client.getStartPageToken();
      await this.pageTokenStore.savePageToken(this.pageToken);

      const files = await this.client.listFiles(this.folderId);
      for (const file of files) {
        this.cacheFile(file);
        await this.emitFileChange(file);
      }
    }

    this.pollTimer = setInterval(() => {
      this.pollOnce().catch((error) => {
        this.errorHandler?.(error instanceof Error ? error : new Error(String(error)));
      });
    }, this.pollIntervalMs);
  }

  async stop(): Promise<void> {
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
  }

  private async pollOnce(): Promise<void> {
    if (!this.pageToken) return;

    const result = await this.client.getChanges(this.pageToken);

    for (const change of result.changes) {
      if (!change.removed && change.file) {
        if (!change.file.parents?.includes(this.folderId)) continue;

        this.cacheFile(change.file);
        await this.emitFileChange(change.file);
      } else if (change.removed) {
        const cached = this.fileCache.get(change.fileId);
        if (!cached) continue;

        await this.emitFileDelete(change.fileId, cached.name, cached.extension);
        this.fileCache.delete(change.fileId);
      }
    }

    if (result.newStartPageToken) {
      this.pageToken = result.newStartPageToken;
      await this.pageTokenStore.savePageToken(this.pageToken);
    }
  }

  private async emitFileChange(file: DriveFile): Promise<void> {
    const ext = path.extname(file.name).toLowerCase();

    const event: FileChangeEvent = {
      id: `gdrive://${file.id}`,
      name: file.name,
      extension: ext,
      mtime: new Date(file.modifiedTime).getTime(),
      readData: () => this.client.downloadFile(file.id),
    };

    try {
      await this.fileHandler?.(event);
    } catch (error) {
      this.errorHandler?.(error as Error);
    }
  }

  private async emitFileDelete(fileId: string, name: string, extension: string): Promise<void> {
    const event: FileDeleteEvent = {
      id: `gdrive://${fileId}`,
      name,
      extension,
    };

    try {
      await this.deleteHandler?.(event);
    } catch (error) {
      this.errorHandler?.(error as Error);
    }
  }

  private cacheFile(file: DriveFile): void {
    this.fileCache.set(file.id, {
      name: file.name,
      extension: path.extname(file.name).toLowerCase(),
    });
  }
}
