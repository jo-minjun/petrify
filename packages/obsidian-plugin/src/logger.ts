import { Notice } from 'obsidian';

type Namespace = 'Watcher' | 'Sync' | 'Convert' | 'Drop';

export interface Logger {
  info(msg: string): void;
  error(msg: string, err?: unknown): void;
  notify(msg: string, timeout?: number): Notice;
}

export function createLogger(namespace: Namespace): Logger {
  const prefix = `[Petrify:${namespace}]`;
  return {
    info: (msg: string) => console.debug(`${prefix} ${msg}`),
    error: (msg: string, err?: unknown) =>
      err ? console.error(`${prefix} ${msg}`, err) : console.error(`${prefix} ${msg}`),
    notify: (msg: string, timeout?: number) => new Notice(`Petrify: ${msg}`, timeout),
  };
}
