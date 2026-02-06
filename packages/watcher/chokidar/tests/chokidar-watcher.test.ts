import type { FileChangeEvent, FileDeleteEvent } from '@petrify/core';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ChokidarWatcher } from '../src/chokidar-watcher.js';

type EventHandler = (...args: unknown[]) => Promise<void> | void;

const mockWatcher = {
  on: vi.fn().mockReturnThis(),
  close: vi.fn().mockResolvedValue(undefined),
};

vi.mock('chokidar', () => ({
  watch: vi.fn(() => mockWatcher),
}));

vi.mock('node:fs/promises', () => ({
  readFile: vi.fn().mockResolvedValue(Buffer.from('mock-content')),
}));

describe('ChokidarWatcher', () => {
  let watcher: ChokidarWatcher;
  let handlers: Map<string, EventHandler>;

  function emit(event: string, ...args: unknown[]) {
    const handler = handlers.get(event);
    if (!handler) throw new Error(`No handler for event: ${event}`);
    return handler(...args);
  }

  beforeEach(() => {
    vi.clearAllMocks();
    handlers = new Map();

    mockWatcher.on.mockImplementation((event: string, handler: EventHandler) => {
      handlers.set(event, handler);
      return mockWatcher;
    });
    mockWatcher.close.mockResolvedValue(undefined);

    watcher = new ChokidarWatcher('/test/dir');
  });

  afterEach(async () => {
    await watcher.stop();
  });

  it('start 시 chokidar.watch를 올바른 옵션으로 호출한다', async () => {
    const { watch } = await import('chokidar');

    await watcher.start();

    expect(watch).toHaveBeenCalledWith('/test/dir', {
      persistent: true,
      ignoreInitial: false,
      alwaysStat: true,
      depth: 0,
    });
  });

  it('add 이벤트 시 FileChangeEvent를 올바른 필드로 발행한다', async () => {
    const events: FileChangeEvent[] = [];
    watcher.onFileChange(async (event) => {
      events.push(event);
    });

    await watcher.start();
    await emit('add', '/test/dir/note.note', { mtimeMs: 1700000000000 });

    expect(events).toHaveLength(1);
    expect(events[0].id).toBe('/test/dir/note.note');
    expect(events[0].name).toBe('note.note');
    expect(events[0].extension).toBe('.note');
    expect(events[0].mtime).toBe(1700000000000);
  });

  it('change 이벤트 시 FileChangeEvent를 발행한다', async () => {
    const events: FileChangeEvent[] = [];
    watcher.onFileChange(async (event) => {
      events.push(event);
    });

    await watcher.start();
    await emit('change', '/test/dir/note.note', { mtimeMs: 1700000001000 });

    expect(events).toHaveLength(1);
    expect(events[0].id).toBe('/test/dir/note.note');
    expect(events[0].mtime).toBe(1700000001000);
  });

  it('unlink 이벤트 시 FileDeleteEvent를 발행한다', async () => {
    const deleteEvents: FileDeleteEvent[] = [];
    watcher.onFileDelete(async (event) => {
      deleteEvents.push(event);
    });

    await watcher.start();
    await emit('unlink', '/test/dir/old.note');

    expect(deleteEvents).toHaveLength(1);
    expect(deleteEvents[0].id).toBe('/test/dir/old.note');
    expect(deleteEvents[0].name).toBe('old.note');
    expect(deleteEvents[0].extension).toBe('.note');
  });

  it('readData()가 fs.readFile을 호출하고 ArrayBuffer를 반환한다', async () => {
    const { readFile } = await import('node:fs/promises');
    const mockBuffer = Buffer.from('test-data');
    vi.mocked(readFile).mockResolvedValue(mockBuffer);

    const events: FileChangeEvent[] = [];
    watcher.onFileChange(async (event) => {
      events.push(event);
    });

    await watcher.start();
    await emit('add', '/test/dir/test.note', { mtimeMs: 1700000000000 });

    const data = await events[0].readData();
    expect(readFile).toHaveBeenCalledWith('/test/dir/test.note');
    expect(data).toBeInstanceOf(ArrayBuffer);
  });

  it('stats가 undefined일 때 Date.now()를 fallback으로 사용한다', async () => {
    const dateNowSpy = vi.spyOn(Date, 'now').mockReturnValue(9999999999999);

    const events: FileChangeEvent[] = [];
    watcher.onFileChange(async (event) => {
      events.push(event);
    });

    await watcher.start();
    await emit('add', '/test/dir/note.note', undefined);

    expect(events[0].mtime).toBe(9999999999999);

    dateNowSpy.mockRestore();
  });

  it('확장자가 대문자일 때 소문자로 변환한다', async () => {
    const events: FileChangeEvent[] = [];
    watcher.onFileChange(async (event) => {
      events.push(event);
    });

    await watcher.start();
    await emit('add', '/test/dir/file.NOTE', { mtimeMs: 1700000000000 });

    expect(events[0].extension).toBe('.note');
  });

  it('fileHandler에서 예외 발생 시 errorHandler를 호출한다', async () => {
    const handlerError = new Error('handler failed');
    const errors: Error[] = [];

    watcher.onFileChange(async () => {
      throw handlerError;
    });
    watcher.onError((error) => {
      errors.push(error);
    });

    await watcher.start();
    await emit('add', '/test/dir/note.note', { mtimeMs: 1700000000000 });

    expect(errors).toHaveLength(1);
    expect(errors[0]).toBe(handlerError);
  });

  it('deleteHandler에서 예외 발생 시 errorHandler를 호출한다', async () => {
    const handlerError = new Error('delete handler failed');
    const errors: Error[] = [];

    watcher.onFileDelete(async () => {
      throw handlerError;
    });
    watcher.onError((error) => {
      errors.push(error);
    });

    await watcher.start();
    await emit('unlink', '/test/dir/note.note');

    expect(errors).toHaveLength(1);
    expect(errors[0]).toBe(handlerError);
  });

  it('chokidar error 이벤트 시 errorHandler를 호출한다', async () => {
    const errors: Error[] = [];
    watcher.onError((error) => {
      errors.push(error);
    });

    await watcher.start();
    emit('error', new Error('watch error'));

    expect(errors).toHaveLength(1);
    expect(errors[0].message).toBe('watch error');
  });

  it('chokidar error에 non-Error 객체가 올 때 Error로 래핑한다', async () => {
    const errors: Error[] = [];
    watcher.onError((error) => {
      errors.push(error);
    });

    await watcher.start();
    emit('error', 'string error');

    expect(errors).toHaveLength(1);
    expect(errors[0]).toBeInstanceOf(Error);
    expect(errors[0].message).toBe('string error');
  });

  it('stop 시 watcher를 close한다', async () => {
    await watcher.start();
    await watcher.stop();

    expect(mockWatcher.close).toHaveBeenCalledOnce();
  });

  it('핸들러 미등록 상태에서 이벤트 발생 시 크래시하지 않는다', async () => {
    await watcher.start();

    await expect(
      emit('add', '/test/dir/note.note', { mtimeMs: 1700000000000 }),
    ).resolves.toBeUndefined();
    await expect(emit('unlink', '/test/dir/note.note')).resolves.toBeUndefined();
  });

  it('start 전에 stop 호출해도 안전하다', async () => {
    await expect(watcher.stop()).resolves.toBeUndefined();
  });

  it('확장자 없는 파일도 처리한다', async () => {
    const events: FileChangeEvent[] = [];
    watcher.onFileChange(async (event) => {
      events.push(event);
    });

    await watcher.start();
    await emit('add', '/test/dir/Makefile', { mtimeMs: 1700000000000 });

    expect(events).toHaveLength(1);
    expect(events[0].name).toBe('Makefile');
    expect(events[0].extension).toBe('');
  });
});
