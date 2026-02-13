import type {
  FileGeneratorPort,
  GeneratorOutput,
  IncrementalInput,
  Note,
  OcrTextResult,
} from '@petrify/core';
import { mergeOcrResults } from '@petrify/core';
import { extractOcrByPageId } from './ocr-extractor.js';

export class MarkdownFileGenerator implements FileGeneratorPort {
  readonly id = 'markdown';
  readonly displayName = 'Markdown';
  readonly extension = '.md';

  generate(note: Note, outputName: string, ocrResults?: OcrTextResult[]): GeneratorOutput {
    const assets = new Map<string, Uint8Array>();
    const sortedPages = [...note.pages].sort((a, b) => a.order - b.order);

    const imageLines: string[] = [];
    const ocrParts: string[] = [];

    for (const page of sortedPages) {
      const filename = `${page.id}.png`;
      assets.set(filename, page.imageData);

      imageLines.push(`![[assets/${outputName}/${filename}]]`);

      const pageOcr = ocrResults?.find((r) => r.pageIndex === page.order);
      if (pageOcr && pageOcr.texts.length > 0) {
        ocrParts.push(`<!-- page: ${pageOcr.pageId} -->`);
        ocrParts.push(pageOcr.texts.join('\n'));
      }
    }

    const imageSection = imageLines.join('\n');
    const ocrSection = ocrParts.length > 0 ? `${ocrParts.join('\n\n')}\n` : '';
    const content = `${imageSection}\n\n---\n\n${ocrSection}`;

    return {
      content: `${content.trim()}\n`,
      assets,
      extension: '.md',
    };
  }

  incrementalUpdate(input: IncrementalInput, note: Note, outputName: string): GeneratorOutput {
    const existingOcr = extractOcrByPageId(input.existingContent);
    const ocrResults = mergeOcrResults(note, existingOcr, input.updates, input.removedPageIds);
    return this.generate(note, outputName, ocrResults);
  }
}
