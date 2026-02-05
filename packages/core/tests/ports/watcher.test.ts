import { describe, it, expect } from 'vitest';
import type { WatcherPort, FileChangeEvent } from '../../src/ports/watcher.js';

describe('WatcherPort', () => {
  it('FileChangeEvent는 readData를 통해 lazy하게 데이터를 읽는다', async () => {
    const testData = new ArrayBuffer(8);
    const event: FileChangeEvent = {
      id: '/path/to/file.note',
      name: 'file.note',
      extension: '.note',
      mtime: 1700000000000,
      readData: async () => testData,
    };

    expect(event.id).toBe('/path/to/file.note');
    expect(event.name).toBe('file.note');
    expect(event.extension).toBe('.note');
    expect(event.mtime).toBe(1700000000000);

    const data = await event.readData();
    expect(data).toBe(testData);
  });

  it('WatcherPort 구현체는 start/stop 라이프사이클을 가진다', async () => {
    let started = false;
    let stopped = false;
    let fileHandler: ((event: FileChangeEvent) => Promise<void>) | null = null;
    let errorHandler: ((error: Error) => void) | null = null;

    const watcher: WatcherPort = {
      onFileChange(handler) { fileHandler = handler; },
      onError(handler) { errorHandler = handler; },
      async start() { started = true; },
      async stop() { stopped = true; },
    };

    watcher.onFileChange(async () => {});
    watcher.onError(() => {});

    await watcher.start();
    expect(started).toBe(true);

    await watcher.stop();
    expect(stopped).toBe(true);

    expect(fileHandler).not.toBeNull();
    expect(errorHandler).not.toBeNull();
  });
});
