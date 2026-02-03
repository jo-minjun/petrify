import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { PetrifyWatcher, type WatcherCallbacks } from '../src/watcher.js';

describe('PetrifyWatcher', () => {
  let watcher: PetrifyWatcher;
  let callbacks: WatcherCallbacks;

  beforeEach(() => {
    callbacks = {
      onFileChange: vi.fn(),
      onError: vi.fn(),
    };
    watcher = new PetrifyWatcher(['.note', '.viwoods'], callbacks);
  });

  afterEach(async () => {
    await watcher.close();
  });

  it('지원하는 확장자 목록을 반환한다', () => {
    expect(watcher.getSupportedExtensions()).toEqual(['.note', '.viwoods']);
  });

  it('파일이 지원되는 확장자인지 확인한다', () => {
    expect(watcher.isSupported('/path/to/file.note')).toBe(true);
    expect(watcher.isSupported('/path/to/file.VIWOODS')).toBe(true);
    expect(watcher.isSupported('/path/to/file.txt')).toBe(false);
  });

  it('감시 중인 디렉터리 목록을 반환한다', () => {
    expect(watcher.getWatchedDirs()).toEqual([]);
  });
});
