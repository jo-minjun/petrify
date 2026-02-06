import type { FileGeneratorPort, GeneratorOutput, Note, OcrTextResult } from '@petrify/core';

export class MarkdownFileGenerator implements FileGeneratorPort {
  readonly id = 'markdown';
  readonly displayName = 'Markdown';
  readonly extension = '.md';

  generate(note: Note, outputName: string, ocrResults?: OcrTextResult[]): GeneratorOutput {
    const assets = new Map<string, Uint8Array>();
    const sortedPages = [...note.pages].sort((a, b) => a.order - b.order);

    let ocrSection = '';
    let imageSection = '';

    for (const page of sortedPages) {
      const filename = `${page.id}.png`;
      assets.set(filename, page.imageData);

      const pageOcr = ocrResults?.find((r) => r.pageIndex === page.order);
      if (pageOcr && pageOcr.texts.length > 0) {
        ocrSection += `${pageOcr.texts.join('\n')}\n\n`;
      }

      imageSection += `![[assets/${outputName}/${filename}]]\n`;
    }

    const content = `${ocrSection}---\n\n${imageSection}`;

    return {
      content: `${content.trim()}\n`,
      assets,
      extension: '.md',
    };
  }
}
