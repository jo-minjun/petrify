import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { runInNewContext } from 'node:vm';
import type { ParserPort } from '@petrify/core';
import { build } from 'esbuild';
import { describe, expect, it, vi } from 'vitest';

describe('bundled PDF parser in an Electron renderer', () => {
  it('loads PDFs through Obsidian without a separately installed worker', async () => {
    const bundle = await build({
      entryPoints: [fileURLToPath(new URL('../src/parser-registry.ts', import.meta.url))],
      bundle: true,
      external: ['obsidian', 'electron'],
      platform: 'node',
      format: 'iife',
      globalName: 'petrify',
      target: 'es2020',
      write: false,
      logLevel: 'silent',
    });
    const pngBytes = new Uint8Array([137, 80, 78, 71]);
    const destroy = vi.fn().mockResolvedValue(undefined);
    const render = vi.fn(() => ({ promise: Promise.resolve() }));
    const getDocument = vi.fn(() => ({
      promise: Promise.resolve({
        numPages: 1,
        getMetadata: () => Promise.resolve({ info: { Title: 'Host PDF' } }),
        getPage: () =>
          Promise.resolve({
            getViewport: () => ({ width: 200, height: 300 }),
            render,
          }),
        destroy,
      }),
    }));
    const loadPdfJs = vi.fn().mockResolvedValue({ getDocument });
    const nodeRequire = createRequire(import.meta.url);
    const parsers: Map<string, ParserPort> = runInNewContext(
      `${bundle.outputFiles[0].text}\npetrify.createParserMap();`,
      {
        require: (id: string) => (id === 'obsidian' ? { loadPdfJs } : nodeRequire(id)),
        process: {
          ...process,
          versions: { ...process.versions, electron: '39.0.0' },
          type: 'renderer',
        },
        console,
        TextEncoder,
        TextDecoder,
        Uint8Array,
        ArrayBuffer,
        URL,
        URLSearchParams,
        DOMException,
        DOMMatrix: class {},
        setTimeout,
        clearTimeout,
        document: {
          createElement: () => ({
            getContext: () => ({}),
            toBlob: (callback: (blob: Blob) => void) => callback(new Blob([pngBytes])),
          }),
        },
      },
    );

    expect(loadPdfJs).not.toHaveBeenCalled();
    const input = new TextEncoder().encode('%PDF-1.7').buffer;
    const parser = parsers.get('pdf');
    if (!parser) throw new Error('PDF parser was not registered');
    const note = await parser.parse(input);

    expect(loadPdfJs).toHaveBeenCalledOnce();
    expect(getDocument).toHaveBeenCalledWith({
      data: new Uint8Array(input),
      useWorkerFetch: false,
      isEvalSupported: false,
    });
    expect(note.title).toBe('Host PDF');
    expect(note.pages).toHaveLength(1);
    expect(note.pages[0].imageData).toEqual(pngBytes);
    expect(render).toHaveBeenCalledOnce();
    expect(destroy).toHaveBeenCalledOnce();
  });
});
