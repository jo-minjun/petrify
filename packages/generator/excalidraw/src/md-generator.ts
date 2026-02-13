import type { OcrTextResult } from '@petrify/core';
import LZString from 'lz-string';
import type { ExcalidrawData } from './excalidraw-generator.js';

export class ExcalidrawMdGenerator {
  generate(
    excalidrawData: ExcalidrawData,
    embeddedFiles?: Record<string, string>,
    ocrResults?: OcrTextResult[],
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

    const lines = Object.entries(embeddedFiles).map(
      ([fileId, filename]) => `${fileId}: [[${filename}]]`,
    );

    return `\n${lines.join('\n')}\n`;
  }

  private formatOcrSection(ocrResults?: OcrTextResult[]): string {
    const lines = ['## OCR Text'];

    if (ocrResults && ocrResults.length > 0) {
      for (const result of ocrResults) {
        lines.push(`<!-- page: ${result.pageId} -->`);
        lines.push(result.texts.join('\n'));
      }
    }

    return `${lines.join('\n')}\n\n`;
  }
}
