import type { Note, FileGeneratorPort, GeneratorOutput, OcrTextResult } from '@petrify/core';
import { ExcalidrawGenerator } from './excalidraw-generator.js';
import { ExcalidrawMdGenerator } from './md-generator.js';

export class ExcalidrawFileGenerator implements FileGeneratorPort {
  readonly id = 'excalidraw';
  readonly displayName = 'Excalidraw';

  private readonly excalidrawGenerator = new ExcalidrawGenerator();
  private readonly mdGenerator = new ExcalidrawMdGenerator();

  generate(note: Note, outputName: string, ocrResults?: OcrTextResult[]): GeneratorOutput {
    const { assets, embeddedFiles } = this.extractAssets(note, outputName);
    const excalidrawData = this.excalidrawGenerator.generateWithoutFiles(note);
    const content = this.mdGenerator.generate(excalidrawData, embeddedFiles, ocrResults);

    return {
      content,
      assets,
      extension: '.excalidraw.md',
    };
  }

  private extractAssets(
    note: Note,
    outputName: string,
  ): { assets: Map<string, Uint8Array>; embeddedFiles: Record<string, string> } {
    const assets = new Map<string, Uint8Array>();
    const embeddedFiles: Record<string, string> = {};
    const sortedPages = [...note.pages].sort((a, b) => a.order - b.order);

    for (const page of sortedPages) {
      const filename = `${page.id}.png`;
      assets.set(filename, page.imageData);
      embeddedFiles[page.id] = `assets/${outputName}/${filename}`;
    }

    return { assets, embeddedFiles };
  }
}
