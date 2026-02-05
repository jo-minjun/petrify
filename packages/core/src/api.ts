import type { ParserPort } from './ports/parser.js';
import type { OcrPort } from './ports/ocr.js';
import { ExcalidrawGenerator } from './excalidraw/generator.js';
import { ExcalidrawMdGenerator } from './excalidraw/md-generator.js';
import { StrokeRenderer } from './rendering/index.js';
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

  // TODO(2026-02-03, minjun.jo): 다중 페이지 OCR 처리 구현 필요
  // 현재는 첫 페이지만 처리
  const firstPage = note.pages[0];
  if (!firstPage || firstPage.strokes.length === 0) {
    const mdGenerator = new ExcalidrawMdGenerator();
    return mdGenerator.generate(excalidrawData);
  }

  const renderer = new StrokeRenderer();
  renderer.render(firstPage.strokes, firstPage.width, firstPage.height);
  const imageBuffer = await renderer.toArrayBuffer();

  const ocrResult = await ocr.recognize(imageBuffer);
  const filteredTexts = filterOcrByConfidence(ocrResult.regions, threshold);

  const ocrResults: OcrTextResult[] = filteredTexts.length > 0
    ? [{ pageIndex: 0, texts: filteredTexts }]
    : [];

  const mdGenerator = new ExcalidrawMdGenerator();
  return mdGenerator.generate(excalidrawData, undefined, ocrResults);
}
