import { webcrypto } from 'node:crypto';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { runInNewContext } from 'node:vm';
import type { FileChangeEvent, FileDeleteEvent, Note } from '@petrify/core';
import { build } from 'esbuild';
import { beforeAll, describe, expect, it } from 'vitest';
import { createFrontmatter } from '../src/utils/frontmatter.js';

let bundle: string;
beforeAll(async () => {
  const result = await build({
    entryPoints: [fileURLToPath(new URL('../src/main.ts', import.meta.url))],
    bundle: true,
    platform: 'node',
    format: 'iife',
    globalName: 'petrify',
    write: false,
    external: [
      'obsidian',
      'electron',
      '@petrify/watcher-chokidar',
      '@petrify/watcher-google-drive',
      '@petrify/parser-pdf',
      '@petrify/ocr-google-vision',
      '@petrify/ocr-tesseract',
    ],
    logLevel: 'silent',
  });
  bundle = result.outputFiles[0].text;
});

async function startPlugin(source: 'local' | 'drive', keep: boolean, savedSource?: string) {
  const id = source === 'drive' ? 'gdrive://file123' : '/notes/test.pdf';
  const path = 'Converted/test.md';
  const original = `${createFrontmatter({
    source: savedSource ?? id,
    parser: 'pdf',
    fileHash: 'old',
    pageHashes: null,
    keep,
  })}User text`;
  const files = new Map([[`/vault/${path}`, original]]);
  const deleted: string[] = [];
  const watchers: Watcher[] = [];

  class Watcher {
    change: (event: FileChangeEvent) => Promise<void> = () => Promise.resolve();
    deleted: (event: FileDeleteEvent) => Promise<void> = () => Promise.resolve();
    constructor() {
      watchers.push(this);
    }
    onFileChange(handler: typeof this.change) {
      this.change = handler;
    }
    onFileDelete(handler: typeof this.deleted) {
      this.deleted = handler;
    }
    onError() {}
    start() {
      return Promise.resolve();
    }
    stop() {
      return Promise.resolve();
    }
  }
  class Plugin {
    addRibbonIcon() {
      return null;
    }
    addCommand() {}
    registerEvent() {}
    addSettingTab() {}
    registerDomEvent() {}
  }
  class TFile {
    constructor(readonly path: string) {}
  }
  class PdfParser {
    readonly extensions = ['.pdf'];
    constructor(readonly id: string) {}
    parse(): Promise<Note> {
      return Promise.resolve({
        title: 'PDF',
        createdAt: new Date(0),
        modifiedAt: new Date(0),
        pages: [{ id: 'p1', order: 0, width: 100, height: 100, imageData: new Uint8Array([1]) }],
      });
    }
  }
  const mocks: Record<string, unknown> = {
    obsidian: {
      Plugin,
      PluginSettingTab: class {},
      Modal: class {},
      Notice: class {},
      TFile,
      TFolder: class {},
      normalizePath: (value: string) => value.replaceAll('\\', '/'),
      setIcon() {},
    },
    '@petrify/watcher-chokidar': { ChokidarWatcher: Watcher },
    '@petrify/watcher-google-drive': {
      GoogleDriveWatcher: Watcher,
      GoogleDriveClient: class {},
      GoogleDriveAuth: class {
        restoreSession() {
          return Promise.resolve({});
        }
      },
    },
    '@petrify/parser-pdf': { PdfParser },
    '@petrify/ocr-google-vision': {
      GoogleVisionOcr: class {
        recognize() {
          return Promise.resolve({ regions: [] });
        }
      },
    },
    '@petrify/ocr-tesseract': { TesseractOcr: class {} },
    'node:fs/promises': {
      readFile: (file: string) => {
        const content = files.get(file);
        return content === undefined
          ? Promise.reject(new Error('ENOENT'))
          : Promise.resolve(content);
      },
    },
  };
  const nodeRequire = createRequire(import.meta.url);
  const Main: new () => {
    app: unknown;
    loadData(): Promise<unknown>;
    onload(): Promise<void>;
    onunload(): void;
  } = runInNewContext(`${bundle}\npetrify.default;`, {
    require: (name: string) => mocks[name] ?? nodeRequire(name),
    process,
    console,
    structuredClone,
    crypto: webcrypto,
    TextEncoder,
    TextDecoder,
    URL,
    URLSearchParams,
    DOMException,
    Buffer,
    Uint8Array,
    ArrayBuffer,
    setTimeout,
    clearTimeout,
    setInterval,
    clearInterval,
    document: {},
  });
  const plugin = new Main();
  plugin.app = {
    secretStorage: { getSecret: () => 'test' },
    workspace: { on() {} },
    vault: {
      adapter: {
        getBasePath: () => '/vault',
        exists: () => Promise.resolve(true),
        write: (file: string, content: string) => {
          files.set(`/vault/${file}`, content);
          return Promise.resolve();
        },
        writeBinary: () => Promise.resolve(),
      },
      getAbstractFileByPath: (file: string) => new TFile(file),
    },
    fileManager: {
      trashFile: (file: TFile) => {
        deleted.push(file.path);
        return Promise.resolve();
      },
    },
  };
  plugin.loadData = () =>
    Promise.resolve({
      outputFormat: 'markdown',
      ocr: { provider: 'google-vision' },
      localWatch: {
        enabled: source === 'local',
        mappings:
          source === 'local'
            ? [{ watchDir: '/notes', outputDir: 'Converted', enabled: true, parserId: 'pdf' }]
            : [],
      },
      googleDrive: {
        enabled: source === 'drive',
        autoPolling: true,
        clientId: 'test',
        mappings:
          source === 'drive'
            ? [{ folderId: 'folder123', outputDir: 'Converted', enabled: true, parserId: 'pdf' }]
            : [],
      },
    });
  await plugin.onload();
  return { plugin, watcher: watchers[0], files, deleted, original, path, id };
}

describe('plugin persisted conversion state', () => {
  it('preserves a protected Drive output after plugin initialization', async () => {
    const state = await startPlugin('drive', true);
    try {
      await state.watcher.change({
        id: state.id,
        name: 'test.pdf',
        extension: '.pdf',
        readData: () => Promise.resolve(new Uint8Array([1, 2]).buffer),
      });
      expect(state.files.get(`/vault/${state.path}`)).toBe(state.original);
    } finally {
      state.plugin.onunload();
    }
  });

  it('deletes an unprotected output for its deleted source', async () => {
    const state = await startPlugin('local', false);
    try {
      await state.watcher.deleted({ id: state.id, name: 'test.pdf', extension: '.pdf' });
      expect(state.deleted).toEqual([state.path]);
    } finally {
      state.plugin.onunload();
    }
  });

  it.each([
    { keep: true, savedSource: '/notes/test.pdf', extension: '.pdf', id: '/notes/test.pdf' },
    { keep: false, savedSource: '/other/test.pdf', extension: '.pdf', id: '/notes/test.pdf' },
    { keep: false, savedSource: '/notes/test.pdf', extension: '.txt', id: '/notes/test.txt' },
  ])('preserves protected or unrelated outputs on deletion: %j', async (scenario) => {
    const state = await startPlugin('local', scenario.keep, scenario.savedSource);
    try {
      await state.watcher.deleted({
        id: scenario.id,
        name: `test${scenario.extension}`,
        extension: scenario.extension,
      });
      expect(state.deleted).toEqual([]);
    } finally {
      state.plugin.onunload();
    }
  });
});
