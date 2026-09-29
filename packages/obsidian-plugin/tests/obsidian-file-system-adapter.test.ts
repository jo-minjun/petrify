import type { App } from 'obsidian';
import { describe, expect, it, vi } from 'vitest';
import { ObsidianFileSystemAdapter } from '../src/obsidian-file-system-adapter.js';

vi.mock('obsidian', () => ({ normalizePath: (value: string) => value.replaceAll('\\', '/') }));

describe('ObsidianFileSystemAdapter', () => {
  it.each([
    '../victim.png',
    '..\\victim.png',
    '/victim.png',
    'C:\\victim.png',
    '',
    '.',
    '..',
  ])('rejects an unsafe asset name before writing: %s', async (name) => {
    const writeBinary = vi.fn();
    const app = { vault: { adapter: { exists: vi.fn().mockResolvedValue(true), writeBinary } } };
    const writer = new ObsidianFileSystemAdapter(app as unknown as App);

    await expect(writer.writeAsset('out/assets/note', name, new Uint8Array([1]))).rejects.toThrow(
      'Invalid asset filename',
    );
    expect(writeBinary).not.toHaveBeenCalled();
  });

  it('writes only bytes belonging to the asset view', async () => {
    const writeBinary = vi.fn();
    const app = { vault: { adapter: { exists: vi.fn().mockResolvedValue(true), writeBinary } } };
    const writer = new ObsidianFileSystemAdapter(app as unknown as App);
    await writer.writeAsset(
      'out/assets/note',
      'page.png',
      new Uint8Array([9, 1, 2, 9]).subarray(1, 3),
    );

    expect(writeBinary.mock.calls[0][0]).toBe('out/assets/note/page.png');
    expect(new Uint8Array(writeBinary.mock.calls[0][1])).toEqual(new Uint8Array([1, 2]));
  });
});
