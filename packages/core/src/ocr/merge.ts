import type { Note } from '../models/index.js';
import type { OcrTextResult } from '../ports/file-generator.js';

/**
 * Merges existing OCR results with updated ones for incremental updates.
 * For each page in the note: uses updated OCR if available, otherwise falls back to existing OCR.
 * Skips removed pages entirely.
 */
export function mergeOcrResults(
  note: Note,
  existingOcrByPageId: ReadonlyMap<string, string[]>,
  updates: ReadonlyMap<string, { ocrResult?: OcrTextResult }>,
  removedPageIds: readonly string[],
): OcrTextResult[] {
  const removedSet = new Set(removedPageIds);
  const sortedPages = [...note.pages].sort((a, b) => a.order - b.order);
  const ocrResults: OcrTextResult[] = [];

  for (const page of sortedPages) {
    if (removedSet.has(page.id)) continue;

    const update = updates.get(page.id);
    if (update?.ocrResult) {
      ocrResults.push(update.ocrResult);
      continue;
    }

    const existingTexts = existingOcrByPageId.get(page.id);
    if (existingTexts && existingTexts.length > 0) {
      ocrResults.push({
        pageId: page.id,
        pageIndex: page.order,
        texts: existingTexts,
      });
    }
  }

  return ocrResults;
}
