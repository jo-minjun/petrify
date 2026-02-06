import LZString from 'lz-string';
import type { OcrTextResult } from '@petrify/core';
import type { ExcalidrawData } from './excalidraw-generator.js';

export class ExcalidrawMdGenerator {
  generate(
    excalidrawData: ExcalidrawData,
    embeddedFiles?: Record<string, string>,
    ocrResults?: OcrTextResult[]
  ): string {
    const compressed = LZString.compressToBase64(JSON.stringify(excalidrawData));
    const embeddedSection = this.formatEmbeddedFiles(embeddedFiles);
    const ocrSection = this.formatOcrSection(ocrResults);

    return `${ocrSection}
# Excalidraw Data

## Text Elements
## Embedded Files
${embeddedSection}
%%
## Drawing
\`\`\`compressed-json
${compressed}
\`\`\`
%%
`;
  }

  private formatEmbeddedFiles(embeddedFiles?: Record<string, string>): string {
    if (!embeddedFiles || Object.keys(embeddedFiles).length === 0) {
      return '\n';
    }

    const lines = Object.entries(embeddedFiles)
      .map(([fileId, filename]) => `${fileId}: [[${filename}]]`);

    return '\n' + lines.join('\n') + '\n';
  }

  private formatOcrSection(ocrResults?: OcrTextResult[]): string {
    let section = '## OCR Text\n';
    if (!ocrResults || ocrResults.length === 0) {
      return section + '\n';
    }
    for (const result of ocrResults) {
      section += `<!-- Page ${result.pageIndex + 1} -->\n`;
      section += result.texts.join('\n') + '\n';
    }
    return section + '\n';
  }
}
