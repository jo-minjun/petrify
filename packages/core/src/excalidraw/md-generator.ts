import LZString from 'lz-string';
import type { ExcalidrawData } from './generator.js';

export interface OcrTextResult {
  pageIndex: number;
  texts: string[];
}

export class ExcalidrawMdGenerator {
  generate(
    excalidrawData: ExcalidrawData,
    embeddedFiles?: Record<string, string>
  ): string {
    const compressed = LZString.compressToBase64(JSON.stringify(excalidrawData));
    const embeddedSection = this.formatEmbeddedFiles(embeddedFiles);

    return `---
excalidraw-plugin: parsed
tags:
---

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
    return section + '\n';
  }
}
