import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createLogger } from '../src/logger.js';

vi.mock('obsidian', () => ({
  Notice: vi.fn(),
}));

import { Notice } from 'obsidian';

describe('createLogger', () => {
  let consoleSpy: ReturnType<typeof vi.spyOn>;
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();
    consoleSpy = vi.spyOn(console, 'debug').mockImplementation(() => {});
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleSpy.mockRestore();
    consoleErrorSpy.mockRestore();
  });

  it('info calls console.debug with [Petrify:Namespace] prefix', () => {
    const log = createLogger('Watcher');
    log.info('File detected: test.note');
    expect(consoleSpy).toHaveBeenCalledWith('[Petrify:Watcher] File detected: test.note');
  });

  it('error calls console.error with [Petrify:Namespace] prefix', () => {
    const log = createLogger('Sync');
    log.error('Directory unreadable: /tmp');
    expect(consoleErrorSpy).toHaveBeenCalledWith('[Petrify:Sync] Directory unreadable: /tmp');
  });

  it('error passes the error object as the second argument', () => {
    const log = createLogger('Convert');
    const err = new Error('fail');
    log.error('Conversion failed: test.note', err);
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      '[Petrify:Convert] Conversion failed: test.note',
      err,
    );
  });

  it('notify creates a Notice with Petrify: prefix', () => {
    const log = createLogger('Watcher');
    log.notify('Converted: test.note');
    expect(Notice).toHaveBeenCalledWith('Petrify: Converted: test.note', undefined);
  });

  it('notify passes timeout to Notice', () => {
    const log = createLogger('Sync');
    log.notify('Sync complete: 3 converted, 0 failed', 5000);
    expect(Notice).toHaveBeenCalledWith('Petrify: Sync complete: 3 converted, 0 failed', 5000);
  });
});
