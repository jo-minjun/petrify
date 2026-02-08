import type { FileChangeEvent, FileDeleteEvent } from '@petrify/core';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GoogleDriveWatcher } from '../src/google-drive-watcher.js';
import type { PageTokenStore } from '../src/types.js';

const mockClient = {
  listFiles: vi.fn().mockResolvedValue([]),
  getStartPageToken: vi.fn().mockResolvedValue('token-1'),
  getChanges: vi.fn().mockResolvedValue({ changes: [], newStartPageToken: 'token-2' }),
  downloadFile: vi.fn().mockResolvedValue(new ArrayBuffer(8)),
  getFile: vi.fn(),
};

vi.mock('../src/google-drive-client.js', () => ({
  GoogleDriveClient: vi.fn(() => mockClient),
}));

function createInMemoryPageTokenStore(): PageTokenStore {
  let token: string | null = null;
  return {
    async loadPageToken() {
      return token;
    },
    async savePageToken(t) {
      token = t;
    },
  };
}

describe('GoogleDriveWatcher', () => {
  let watcher: GoogleDriveWatcher;
  let pageTokenStore: PageTokenStore;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();

    mockClient.listFiles.mockResolvedValue([]);
    mockClient.getStartPageToken.mockResolvedValue('token-1');
    mockClient.getChanges.mockResolvedValue({ changes: [], newStartPageToken: 'token-2' });
    mockClient.downloadFile.mockResolvedValue(new ArrayBuffer(8));

    pageTokenStore = createInMemoryPageTokenStore();
    watcher = new GoogleDriveWatcher({
      folderId: 'test-folder-id',
      pollIntervalMs: 30000,
      auth: {} as unknown as import('google-auth-library').OAuth2Client,
      pageTokenStore,
    });
  });

  afterEach(async () => {
    await watcher.stop();
    vi.useRealTimers();
  });

  it('implements the WatcherPort interface', () => {
    expect(typeof watcher.onFileChange).toBe('function');
    expect(typeof watcher.onFileDelete).toBe('function');
    expect(typeof watcher.onError).toBe('function');
    expect(typeof watcher.start).toBe('function');
    expect(typeof watcher.stop).toBe('function');
  });

  it('emits FileChangeEvent via initial scan on start', async () => {
    mockClient.listFiles.mockResolvedValue([
      {
        id: 'f1',
        name: 'test.note',
        mimeType: 'application/octet-stream',
        modifiedTime: '2026-01-01T00:00:00.000Z',
        parents: ['test-folder-id'],
      },
    ]);

    const events: FileChangeEvent[] = [];
    watcher.onFileChange(async (event) => {
      events.push(event);
    });

    await watcher.start();

    expect(events).toHaveLength(1);
    expect(events[0].name).toBe('test.note');
    expect(events[0].id).toBe('gdrive://f1');
    expect(events[0].extension).toBe('.note');
  });

  it('readData downloads the file during initial scan', async () => {
    mockClient.listFiles.mockResolvedValue([
      {
        id: 'f1',
        name: 'test.note',
        mimeType: 'application/octet-stream',
        modifiedTime: '2026-01-01T00:00:00.000Z',
        parents: ['test-folder-id'],
      },
    ]);
    mockClient.downloadFile.mockResolvedValue(new ArrayBuffer(16));

    const events: FileChangeEvent[] = [];
    watcher.onFileChange(async (event) => {
      events.push(event);
    });

    await watcher.start();

    const data = await events[0].readData();
    expect(data.byteLength).toBe(16);
    expect(mockClient.downloadFile).toHaveBeenCalledWith('f1');
  });

  it('skips initial scan when a saved pageToken exists', async () => {
    await pageTokenStore.savePageToken('existing-token');

    watcher = new GoogleDriveWatcher({
      folderId: 'test-folder-id',
      pollIntervalMs: 30000,
      auth: {} as unknown as import('google-auth-library').OAuth2Client,
      pageTokenStore,
    });

    const events: FileChangeEvent[] = [];
    watcher.onFileChange(async (event) => {
      events.push(event);
    });

    await watcher.start();

    expect(mockClient.listFiles).not.toHaveBeenCalled();
    expect(mockClient.getStartPageToken).not.toHaveBeenCalled();
    expect(events).toHaveLength(0);
  });

  it('emits FileChangeEvent when polling detects a file addition', async () => {
    mockClient.getChanges.mockResolvedValue({
      changes: [
        {
          fileId: 'f1',
          removed: false,
          file: {
            id: 'f1',
            name: 'new.note',
            mimeType: 'application/octet-stream',
            modifiedTime: '2026-01-01T00:00:00.000Z',
            parents: ['test-folder-id'],
          },
          time: '2026-01-01T00:00:00.000Z',
        },
      ],
      newStartPageToken: 'token-3',
    });

    const events: FileChangeEvent[] = [];
    watcher.onFileChange(async (event) => {
      events.push(event);
    });

    await watcher.start();
    await vi.advanceTimersByTimeAsync(30000);

    expect(events.some((e) => e.name === 'new.note')).toBe(true);
  });

  it('emits FileDeleteEvent when polling detects a file deletion', async () => {
    mockClient.listFiles.mockResolvedValue([
      {
        id: 'f1',
        name: 'deleted.note',
        mimeType: 'application/octet-stream',
        modifiedTime: '2026-01-01T00:00:00.000Z',
        parents: ['test-folder-id'],
      },
    ]);

    mockClient.getChanges.mockResolvedValue({
      changes: [{ fileId: 'f1', removed: true, time: '2026-01-02T00:00:00.000Z' }],
      newStartPageToken: 'token-3',
    });

    const deleteEvents: FileDeleteEvent[] = [];
    watcher.onFileChange(async () => {});
    watcher.onFileDelete(async (event) => {
      deleteEvents.push(event);
    });

    await watcher.start();
    await vi.advanceTimersByTimeAsync(30000);

    expect(deleteEvents).toHaveLength(1);
    expect(deleteEvents[0].name).toBe('deleted.note');
    expect(deleteEvents[0].id).toBe('gdrive://f1');
  });

  it('ignores changes outside the target folder', async () => {
    mockClient.getChanges.mockResolvedValue({
      changes: [
        {
          fileId: 'f-other',
          removed: false,
          file: {
            id: 'f-other',
            name: 'other.note',
            mimeType: 'application/octet-stream',
            modifiedTime: '2026-01-01T00:00:00.000Z',
            parents: ['other-folder-id'],
          },
          time: '2026-01-01T00:00:00.000Z',
        },
      ],
      newStartPageToken: 'token-3',
    });

    const events: FileChangeEvent[] = [];
    watcher.onFileChange(async (event) => {
      events.push(event);
    });

    await watcher.start();
    await vi.advanceTimersByTimeAsync(30000);

    expect(events.filter((e) => e.name === 'other.note')).toHaveLength(0);
  });

  it('calls onError handler on API error and continues polling', async () => {
    mockClient.getChanges
      .mockRejectedValueOnce(new Error('API Error'))
      .mockResolvedValueOnce({ changes: [], newStartPageToken: 'token-3' });

    const errors: Error[] = [];
    watcher.onFileChange(async () => {});
    watcher.onError((error) => {
      errors.push(error);
    });

    await watcher.start();

    await vi.advanceTimersByTimeAsync(30000);
    expect(errors).toHaveLength(1);
    expect(errors[0].message).toBe('API Error');

    await vi.advanceTimersByTimeAsync(30000);
    expect(mockClient.getChanges).toHaveBeenCalledTimes(2);
  });

  it('stops polling after stop is called', async () => {
    await watcher.start();
    await watcher.stop();

    const callCount = mockClient.getChanges.mock.calls.length;
    await vi.advanceTimersByTimeAsync(60000);

    expect(mockClient.getChanges.mock.calls.length).toBe(callCount);
  });

  it('ignores delete events for files not in cache', async () => {
    mockClient.getChanges.mockResolvedValue({
      changes: [{ fileId: 'unknown-file', removed: true, time: '2026-01-02T00:00:00.000Z' }],
      newStartPageToken: 'token-3',
    });

    const deleteEvents: FileDeleteEvent[] = [];
    watcher.onFileChange(async () => {});
    watcher.onFileDelete(async (event) => {
      deleteEvents.push(event);
    });

    await watcher.start();
    await vi.advanceTimersByTimeAsync(30000);

    expect(deleteEvents).toHaveLength(0);
  });

  it('saves newStartPageToken during polling', async () => {
    mockClient.getChanges.mockResolvedValue({
      changes: [],
      newStartPageToken: 'saved-token',
    });

    await watcher.start();
    await vi.advanceTimersByTimeAsync(30000);

    const savedToken = await pageTokenStore.loadPageToken();
    expect(savedToken).toBe('saved-token');
  });
});
