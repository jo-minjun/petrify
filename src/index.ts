// src/index.ts
export { ViwoodsParser, NoteParser, ColorExtractor, InvalidNoteFileError, ParseError } from '@petrify/parser-viwoods';
export { ExcalidrawGenerator, ExcalidrawMdGenerator } from '@petrify/core';
export type { ExcalidrawData, ExcalidrawElement } from '@petrify/core';
export * from '@petrify/core';

import { NoteParser } from '@petrify/parser-viwoods';
import { ExcalidrawGenerator, ExcalidrawMdGenerator } from '@petrify/core';
import type { ExcalidrawData } from '@petrify/core';

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
