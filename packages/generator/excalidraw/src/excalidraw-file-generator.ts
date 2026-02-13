import type {
  FileGeneratorPort,
  GeneratorOutput,
  IncrementalInput,
  Note,
  OcrTextResult,
} from '@petrify/core';
import { mergeOcrResults, sha1Hex } from '@petrify/core';
import { ExcalidrawGenerator } from './excalidraw-generator.js';
import { ExcalidrawMdGenerator } from './md-generator.js';
import { extractOcrByPageId } from './ocr-extractor.js';

export class ExcalidrawFileGenerator implements FileGeneratorPort {
  readonly id = 'excalidraw';
  readonly displayName = 'Excalidraw';
  readonly extension = '.excalidraw.md';

  private readonly excalidrawGenerator = new ExcalidrawGenerator();
  private readonly mdGenerator = new ExcalidrawMdGenerator();

  async generate(
    note: Note,
    outputName: string,
    ocrResults?: OcrTextResult[],
  ): Promise<GeneratorOutput> {
    const { assets, embeddedFiles } = await this.extractAssets(note, outputName);
    const excalidrawData = await this.excalidrawGenerator.generateWithoutFiles(note);
    const content = this.mdGenerator.generate(excalidrawData, embeddedFiles, ocrResults);

    return {
      content,
      assets,
      extension: '.excalidraw.md',
    };
  }

  async incrementalUpdate(
    input: IncrementalInput,
    note: Note,
    outputName: string,
  ): Promise<GeneratorOutput> {
    const existingOcr = extractOcrByPageId(input.existingContent);
    const ocrResults = mergeOcrResults(note, existingOcr, input.updates, input.removedPageIds);
    return this.generate(note, outputName, ocrResults);
  }

  private async extractAssets(
    note: Note,
    outputName: string,
  ): Promise<{ assets: Map<string, Uint8Array>; embeddedFiles: Record<string, string> }> {
    const assets = new Map<string, Uint8Array>();
    const embeddedFiles: Record<string, string> = {};
    const sortedPages = [...note.pages].sort((a, b) => a.order - b.order);

    for (const page of sortedPages) {
      const hash = await sha1Hex(page.imageData);
      const filename = `${hash}.png`;
      assets.set(filename, page.imageData);
      embeddedFiles[hash] = `assets/${outputName}/${filename}`;
    }

    return { assets, embeddedFiles };
  }
}
