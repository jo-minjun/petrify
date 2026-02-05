import { Notice } from 'obsidian';

type Namespace = 'Watcher' | 'Sync' | 'Convert' | 'Drop';

export function createLogger(namespace: Namespace) {
  const prefix = `[Petrify:${namespace}]`;
  return {
    info: (msg: string) => console.log(`${prefix} ${msg}`),
    error: (msg: string, err?: unknown) =>
      err ? console.error(`${prefix} ${msg}`, err) : console.error(`${prefix} ${msg}`),
    notify: (msg: string, timeout?: number) => new Notice(`Petrify: ${msg}`, timeout),
  };
}
