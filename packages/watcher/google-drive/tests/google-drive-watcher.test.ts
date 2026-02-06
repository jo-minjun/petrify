import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { FileChangeEvent, FileDeleteEvent } from '@petrify/core';
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
    async loadPageToken() { return token; },
    async savePageToken(t) { token = t; },
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
      auth: {} as any,
      pageTokenStore,
    });
  });

  afterEach(async () => {
    await watcher.stop();
    vi.useRealTimers();
  });

  it('WatcherPort 인터페이스를 구현한다', () => {
    expect(typeof watcher.onFileChange).toBe('function');
    expect(typeof watcher.onFileDelete).toBe('function');
    expect(typeof watcher.onError).toBe('function');
    expect(typeof watcher.start).toBe('function');
    expect(typeof watcher.stop).toBe('function');
  });

  it('start 시 초기 스캔으로 FileChangeEvent를 발행한다', async () => {
    mockClient.listFiles.mockResolvedValue([
      { id: 'f1', name: 'test.note', mimeType: 'application/octet-stream', modifiedTime: '2026-01-01T00:00:00.000Z', parents: ['test-folder-id'] },
    ]);

    const events: FileChangeEvent[] = [];
    watcher.onFileChange(async (event) => { events.push(event); });

    await watcher.start();

    expect(events).toHaveLength(1);
    expect(events[0].name).toBe('test.note');
    expect(events[0].id).toBe('gdrive://f1');
    expect(events[0].extension).toBe('.note');
  });

  it('초기 스캔에서 readData는 파일 다운로드를 수행한다', async () => {
    mockClient.listFiles.mockResolvedValue([
      { id: 'f1', name: 'test.note', mimeType: 'application/octet-stream', modifiedTime: '2026-01-01T00:00:00.000Z', parents: ['test-folder-id'] },
    ]);
    mockClient.downloadFile.mockResolvedValue(new ArrayBuffer(16));

    const events: FileChangeEvent[] = [];
    watcher.onFileChange(async (event) => { events.push(event); });

    await watcher.start();

    const data = await events[0].readData();
    expect(data.byteLength).toBe(16);
    expect(mockClient.downloadFile).toHaveBeenCalledWith('f1');
  });

  it('저장된 pageToken이 있으면 초기 스캔을 생략한다', async () => {
    await pageTokenStore.savePageToken('existing-token');

    watcher = new GoogleDriveWatcher({
      folderId: 'test-folder-id',
      pollIntervalMs: 30000,
      auth: {} as any,
      pageTokenStore,
    });

    const events: FileChangeEvent[] = [];
    watcher.onFileChange(async (event) => { events.push(event); });

    await watcher.start();

    expect(mockClient.listFiles).not.toHaveBeenCalled();
    expect(mockClient.getStartPageToken).not.toHaveBeenCalled();
    expect(events).toHaveLength(0);
  });

  it('폴링으로 파일 추가를 감지하면 FileChangeEvent를 발행한다', async () => {
    mockClient.getChanges.mockResolvedValue({
      changes: [{
        fileId: 'f1',
        removed: false,
        file: { id: 'f1', name: 'new.note', mimeType: 'application/octet-stream', modifiedTime: '2026-01-01T00:00:00.000Z', parents: ['test-folder-id'] },
        time: '2026-01-01T00:00:00.000Z',
      }],
      newStartPageToken: 'token-3',
    });

    const events: FileChangeEvent[] = [];
    watcher.onFileChange(async (event) => { events.push(event); });

    await watcher.start();
    await vi.advanceTimersByTimeAsync(30000);

    expect(events.some((e) => e.name === 'new.note')).toBe(true);
  });

  it('폴링으로 파일 삭제를 감지하면 FileDeleteEvent를 발행한다', async () => {
    mockClient.listFiles.mockResolvedValue([
      { id: 'f1', name: 'deleted.note', mimeType: 'application/octet-stream', modifiedTime: '2026-01-01T00:00:00.000Z', parents: ['test-folder-id'] },
    ]);

    mockClient.getChanges.mockResolvedValue({
      changes: [{ fileId: 'f1', removed: true, time: '2026-01-02T00:00:00.000Z' }],
      newStartPageToken: 'token-3',
    });

    const deleteEvents: FileDeleteEvent[] = [];
    watcher.onFileChange(async () => {});
    watcher.onFileDelete(async (event) => { deleteEvents.push(event); });

    await watcher.start();
    await vi.advanceTimersByTimeAsync(30000);

    expect(deleteEvents).toHaveLength(1);
    expect(deleteEvents[0].name).toBe('deleted.note');
    expect(deleteEvents[0].id).toBe('gdrive://f1');
  });

  it('대상 폴더 외 변경은 무시한다', async () => {
    mockClient.getChanges.mockResolvedValue({
      changes: [{
        fileId: 'f-other',
        removed: false,
        file: { id: 'f-other', name: 'other.note', mimeType: 'application/octet-stream', modifiedTime: '2026-01-01T00:00:00.000Z', parents: ['other-folder-id'] },
        time: '2026-01-01T00:00:00.000Z',
      }],
      newStartPageToken: 'token-3',
    });

    const events: FileChangeEvent[] = [];
    watcher.onFileChange(async (event) => { events.push(event); });

    await watcher.start();
    await vi.advanceTimersByTimeAsync(30000);

    expect(events.filter((e) => e.name === 'other.note')).toHaveLength(0);
  });

  it('API 에러 시 onError 핸들러를 호출하고 폴링을 지속한다', async () => {
    mockClient.getChanges
      .mockRejectedValueOnce(new Error('API Error'))
      .mockResolvedValueOnce({ changes: [], newStartPageToken: 'token-3' });

    const errors: Error[] = [];
    watcher.onFileChange(async () => {});
    watcher.onError((error) => { errors.push(error); });

    await watcher.start();

    await vi.advanceTimersByTimeAsync(30000);
    expect(errors).toHaveLength(1);
    expect(errors[0].message).toBe('API Error');

    await vi.advanceTimersByTimeAsync(30000);
    expect(mockClient.getChanges).toHaveBeenCalledTimes(2);
  });

  it('stop 후 폴링이 중단된다', async () => {
    await watcher.start();
    await watcher.stop();

    const callCount = mockClient.getChanges.mock.calls.length;
    await vi.advanceTimersByTimeAsync(60000);

    expect(mockClient.getChanges.mock.calls.length).toBe(callCount);
  });

  it('캐시에 없는 파일의 삭제 이벤트는 무시한다', async () => {
    mockClient.getChanges.mockResolvedValue({
      changes: [{ fileId: 'unknown-file', removed: true, time: '2026-01-02T00:00:00.000Z' }],
      newStartPageToken: 'token-3',
    });

    const deleteEvents: FileDeleteEvent[] = [];
    watcher.onFileChange(async () => {});
    watcher.onFileDelete(async (event) => { deleteEvents.push(event); });

    await watcher.start();
    await vi.advanceTimersByTimeAsync(30000);

    expect(deleteEvents).toHaveLength(0);
  });

  it('폴링 시 newStartPageToken을 저장한다', async () => {
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
