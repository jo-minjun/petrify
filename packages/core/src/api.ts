import type { ParserPort } from './ports/parser.js';
import { ExcalidrawGenerator } from './excalidraw/generator.js';
import { ExcalidrawMdGenerator } from './excalidraw/md-generator.js';
import type { ExcalidrawData } from './excalidraw/generator.js';

export async function convert(
  data: ArrayBuffer,
  parser: ParserPort
): Promise<ExcalidrawData> {
  const note = await parser.parse(data);
  const generator = new ExcalidrawGenerator();
  return generator.generate(note);
}

export async function convertToMd(
  data: ArrayBuffer,
  parser: ParserPort
): Promise<string> {
  const excalidrawData = await convert(data, parser);
  const mdGenerator = new ExcalidrawMdGenerator();
  return mdGenerator.generate(excalidrawData);
}
