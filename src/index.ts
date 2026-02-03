// src/index.ts
export { NoteParser } from './parser';
export { ColorExtractor } from './color-extractor';
export { ExcalidrawGenerator } from './excalidraw';
export type { ExcalidrawData, ExcalidrawElement } from './excalidraw';
export { ExcalidrawMdGenerator } from './excalidraw-md';
export { InvalidNoteFileError, ParseError } from './exceptions';
export * from '@petrify/core';

import { NoteParser } from './parser';
import { ExcalidrawGenerator } from './excalidraw';
import type { ExcalidrawData } from './excalidraw';
import { ExcalidrawMdGenerator } from './excalidraw-md';

export async function convert(data: ArrayBuffer): Promise<ExcalidrawData> {
  const parser = new NoteParser();
  const note = await parser.parse(data);
  const generator = new ExcalidrawGenerator();
  return generator.generate(note);
}

export async function convertToMd(data: ArrayBuffer): Promise<string> {
  const excalidrawData = await convert(data);
  const mdGenerator = new ExcalidrawMdGenerator();
  return mdGenerator.generate(excalidrawData);
}
