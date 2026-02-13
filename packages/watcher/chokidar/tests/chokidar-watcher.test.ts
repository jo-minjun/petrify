import type { FileChangeEvent, FileDeleteEvent } from '@petrify/core';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ChokidarWatcher } from '../src/chokidar-watcher.js';

type EventHandler = (...args: unknown[]) => void;

const flushPromises = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

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
    handler(...args);
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

  it('calls chokidar.watch with the correct options on start', async () => {
    const { watch } = await import('chokidar');

    await watcher.start();

    expect(watch).toHaveBeenCalledWith('/test/dir', {
      persistent: true,
      ignoreInitial: false,
      alwaysStat: true,
      depth: 0,
    });
  });

  it('emits a FileChangeEvent with the correct fields on add event', async () => {
    const events: FileChangeEvent[] = [];
    watcher.onFileChange(async (event) => {
      events.push(event);
    });

    await watcher.start();
    emit('add', '/test/dir/note.note');
    await flushPromises();

    expect(events).toHaveLength(1);
    expect(events[0].id).toBe('/test/dir/note.note');
    expect(events[0].name).toBe('note.note');
    expect(events[0].extension).toBe('.note');
  });

  it('emits a FileChangeEvent on change event', async () => {
    const events: FileChangeEvent[] = [];
    watcher.onFileChange(async (event) => {
      events.push(event);
    });

    await watcher.start();
    emit('change', '/test/dir/note.note');
    await flushPromises();

    expect(events).toHaveLength(1);
    expect(events[0].id).toBe('/test/dir/note.note');
  });

  it('emits a FileDeleteEvent on unlink event', async () => {
    const deleteEvents: FileDeleteEvent[] = [];
    watcher.onFileDelete(async (event) => {
      deleteEvents.push(event);
    });

    await watcher.start();
    emit('unlink', '/test/dir/old.note');
    await flushPromises();

    expect(deleteEvents).toHaveLength(1);
    expect(deleteEvents[0].id).toBe('/test/dir/old.note');
    expect(deleteEvents[0].name).toBe('old.note');
    expect(deleteEvents[0].extension).toBe('.note');
  });

  it('readData() calls fs.readFile and returns an ArrayBuffer', async () => {
    const { readFile } = await import('node:fs/promises');
    const mockBuffer = Buffer.from('test-data');
    vi.mocked(readFile).mockResolvedValue(mockBuffer);

    const events: FileChangeEvent[] = [];
    watcher.onFileChange(async (event) => {
      events.push(event);
    });

    await watcher.start();
    emit('add', '/test/dir/test.note');
    await flushPromises();

    const data = await events[0].readData();
    expect(readFile).toHaveBeenCalledWith('/test/dir/test.note');
    expect(data).toBeInstanceOf(ArrayBuffer);
  });

  it('converts uppercase file extensions to lowercase', async () => {
    const events: FileChangeEvent[] = [];
    watcher.onFileChange(async (event) => {
      events.push(event);
    });

    await watcher.start();
    emit('add', '/test/dir/file.NOTE');
    await flushPromises();

    expect(events[0].extension).toBe('.note');
  });

  it('calls errorHandler when fileHandler throws an exception', async () => {
    const handlerError = new Error('handler failed');
    const errors: Error[] = [];

    watcher.onFileChange(async () => {
      throw handlerError;
    });
    watcher.onError((error) => {
      errors.push(error);
    });

    await watcher.start();
    emit('add', '/test/dir/note.note');
    await flushPromises();

    expect(errors).toHaveLength(1);
    expect(errors[0]).toBe(handlerError);
  });

  it('calls errorHandler when deleteHandler throws an exception', async () => {
    const handlerError = new Error('delete handler failed');
    const errors: Error[] = [];

    watcher.onFileDelete(async () => {
      throw handlerError;
    });
    watcher.onError((error) => {
      errors.push(error);
    });

    await watcher.start();
    emit('unlink', '/test/dir/note.note');
    await flushPromises();

    expect(errors).toHaveLength(1);
    expect(errors[0]).toBe(handlerError);
  });

  it('calls errorHandler on chokidar error event', async () => {
    const errors: Error[] = [];
    watcher.onError((error) => {
      errors.push(error);
    });

    await watcher.start();
    emit('error', new Error('watch error'));

    expect(errors).toHaveLength(1);
    expect(errors[0].message).toBe('watch error');
  });

  it('wraps non-Error objects as Error on chokidar error', async () => {
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

  it('closes the watcher on stop', async () => {
    await watcher.start();
    await watcher.stop();

    expect(mockWatcher.close).toHaveBeenCalledOnce();
  });

  it('does not crash when events fire with no handlers registered', async () => {
    await watcher.start();

    expect(() => emit('add', '/test/dir/note.note')).not.toThrow();
    expect(() => emit('unlink', '/test/dir/note.note')).not.toThrow();
  });

  it('is safe to call stop before start', async () => {
    await expect(watcher.stop()).resolves.toBeUndefined();
  });

  it('handles files without an extension', async () => {
    const events: FileChangeEvent[] = [];
    watcher.onFileChange(async (event) => {
      events.push(event);
    });

    await watcher.start();
    emit('add', '/test/dir/Makefile');
    await flushPromises();

    expect(events).toHaveLength(1);
    expect(events[0].name).toBe('Makefile');
    expect(events[0].extension).toBe('');
  });
});
