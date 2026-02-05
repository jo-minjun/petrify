import type { ParserPort } from './ports/parser.js';
import type { OcrPort } from './ports/ocr.js';
import { ExcalidrawGenerator } from './excalidraw/generator.js';
import { ExcalidrawMdGenerator } from './excalidraw/md-generator.js';
import type { ExcalidrawData } from './excalidraw/generator.js';
import type { OcrTextResult } from './excalidraw/md-generator.js';
import { filterOcrByConfidence } from './ocr/filter.js';

export interface ConvertOptions {
  ocrConfidenceThreshold?: number;
}

export const DEFAULT_CONFIDENCE_THRESHOLD = 50;

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

export async function convertToMdWithOcr(
  data: ArrayBuffer,
  parser: ParserPort,
  ocr: OcrPort,
  options?: ConvertOptions
): Promise<string> {
  const threshold = options?.ocrConfidenceThreshold ?? DEFAULT_CONFIDENCE_THRESHOLD;

  const note = await parser.parse(data);
  const generator = new ExcalidrawGenerator();
  const excalidrawData = generator.generate(note);

  const ocrResults: OcrTextResult[] = [];

  for (const page of note.pages) {
    if (page.imageData.length === 0) continue;

    const imageBuffer = new Uint8Array(page.imageData).buffer;
    const ocrResult = await ocr.recognize(imageBuffer);
    const filteredTexts = filterOcrByConfidence(ocrResult.regions, threshold);

    if (filteredTexts.length > 0) {
      ocrResults.push({ pageIndex: page.order, texts: filteredTexts });
    }
  }

  const mdGenerator = new ExcalidrawMdGenerator();
  return mdGenerator.generate(excalidrawData, undefined, ocrResults);
}
