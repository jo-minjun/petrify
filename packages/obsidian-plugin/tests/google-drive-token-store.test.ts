import type { Plugin } from 'obsidian';
import { describe, expect, it } from 'vitest';
import { createPageTokenStore } from '../src/google-drive-token-store.js';
import { updatePluginData } from '../src/plugin-data.js';

function createPlugin() {
  let data: Record<string, unknown> = { outputFormat: 'markdown' };
  return {
    loadData: () => Promise.resolve(structuredClone(data)),
    saveData: (value: Record<string, unknown>) => {
      data = structuredClone(value);
      return Promise.resolve();
    },
  };
}

describe('Drive cursor and file identity persistence', () => {
  it('restores names after constructing a new token store', async () => {
    const plugin = createPlugin();
    const store = createPageTokenStore(plugin as unknown as Plugin, 'folder');
    await store.saveFileCache?.({ file123: { name: 'note.pdf', extension: '.pdf' } });
    await store.savePageToken('cursor');

    const restarted = createPageTokenStore(plugin as unknown as Plugin, 'folder');
    expect(await restarted.loadFileCache?.()).toEqual({
      file123: { name: 'note.pdf', extension: '.pdf' },
    });
    expect(await restarted.loadPageToken()).toBe('cursor');
    expect((await plugin.loadData()).outputFormat).toBe('markdown');
  });

  it('does not lose another folder state during concurrent saves', async () => {
    const plugin = createPlugin();
    const first = createPageTokenStore(plugin as unknown as Plugin, 'first');
    const second = createPageTokenStore(plugin as unknown as Plugin, 'second');
    await Promise.all([first.savePageToken('a'), second.savePageToken('b')]);
    expect(await first.loadPageToken()).toBe('a');
    expect(await second.loadPageToken()).toBe('b');
  });

  it('preserves file identity and cursor while settings are being saved', async () => {
    const plugin = createPlugin();
    const store = createPageTokenStore(plugin as unknown as Plugin, 'folder');
    await Promise.all([
      store.saveFileCache?.({ file123: { name: 'note.pdf', extension: '.pdf' } }),
      updatePluginData(plugin as unknown as Plugin, (data) => ({
        ...data,
        outputFormat: 'excalidraw',
      })),
      store.savePageToken('new-cursor'),
    ]);
    expect(await store.loadFileCache?.()).toEqual({
      file123: { name: 'note.pdf', extension: '.pdf' },
    });
    expect(await store.loadPageToken()).toBe('new-cursor');
    expect((await plugin.loadData()).outputFormat).toBe('excalidraw');
  });
});
