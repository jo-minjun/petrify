import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createLogger } from '../src/logger.js';

vi.mock('obsidian', () => ({
  Notice: vi.fn(),
}));

import { Notice } from 'obsidian';

describe('createLogger', () => {
  let consoleSpy: ReturnType<typeof vi.spyOn>;
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.clearAllMocks();
  });

  afterEach(() => {
    consoleSpy.mockRestore();
    consoleErrorSpy.mockRestore();
  });

  it('info는 [Petrify:Namespace] 접두사로 console.log를 호출한다', () => {
    const log = createLogger('Watcher');
    log.info('File detected: test.note');
    expect(consoleSpy).toHaveBeenCalledWith('[Petrify:Watcher] File detected: test.note');
  });

  it('error는 [Petrify:Namespace] 접두사로 console.error를 호출한다', () => {
    const log = createLogger('Sync');
    log.error('Directory unreadable: /tmp');
    expect(consoleErrorSpy).toHaveBeenCalledWith('[Petrify:Sync] Directory unreadable: /tmp');
  });

  it('error는 에러 객체를 두 번째 인자로 전달한다', () => {
    const log = createLogger('Convert');
    const err = new Error('fail');
    log.error('Conversion failed: test.note', err);
    expect(consoleErrorSpy).toHaveBeenCalledWith('[Petrify:Convert] Conversion failed: test.note', err);
  });

  it('notify는 Petrify: 접두사로 Notice를 생성한다', () => {
    const log = createLogger('Watcher');
    log.notify('Converted: test.note');
    expect(Notice).toHaveBeenCalledWith('Petrify: Converted: test.note', undefined);
  });

  it('notify는 timeout을 전달한다', () => {
    const log = createLogger('Sync');
    log.notify('Sync complete: 3 converted, 0 failed', 5000);
    expect(Notice).toHaveBeenCalledWith('Petrify: Sync complete: 3 converted, 0 failed', 5000);
  });
});
