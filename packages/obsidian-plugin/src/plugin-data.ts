import type { Plugin } from 'obsidian';

const pendingWrites = new WeakMap<Plugin, Promise<void>>();

export function updatePluginData(
  plugin: Plugin,
  update: (data: Record<string, unknown>) => Record<string, unknown>,
): Promise<void> {
  const previous = pendingWrites.get(plugin) ?? Promise.resolve();
  const write = previous
    .catch(() => {})
    .then(async () => {
      const data = (await plugin.loadData()) ?? {};
      await plugin.saveData(update(data));
    });
  pendingWrites.set(plugin, write);
  return write;
}
