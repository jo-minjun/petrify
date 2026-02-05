import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ChokidarWatcher } from '../src/chokidar-watcher.js';

describe('ChokidarWatcher', () => {
  let watcher: ChokidarWatcher;

  beforeEach(() => {
    vi.clearAllMocks();
    watcher = new ChokidarWatcher('/watch/dir');
  });

  it('WatcherPort 인터페이스를 구현한다', () => {
    expect(typeof watcher.onFileChange).toBe('function');
    expect(typeof watcher.onError).toBe('function');
    expect(typeof watcher.start).toBe('function');
    expect(typeof watcher.stop).toBe('function');
  });

  it('start 전에 핸들러를 등록할 수 있다', () => {
    const fileHandler = vi.fn();
    const errorHandler = vi.fn();

    watcher.onFileChange(fileHandler);
    watcher.onError(errorHandler);

    expect(true).toBe(true);
  });

  it('onFileDelete 핸들러를 등록할 수 있다', () => {
    const deleteHandler = vi.fn();
    watcher.onFileDelete(deleteHandler);
    expect(true).toBe(true);
  });
});
