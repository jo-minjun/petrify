import LZString from 'lz-string';
import type { ExcalidrawData } from './excalidraw';

export class ExcalidrawMdGenerator {
  generate(
    excalidrawData: ExcalidrawData,
    embeddedFiles?: Record<string, string>
  ): string {
    const compressed = this.compress(excalidrawData);
    const embeddedSection = this.generateEmbeddedSection(embeddedFiles);

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

  private compress(data: ExcalidrawData): string {
    const jsonStr = JSON.stringify(data);
    return LZString.compressToBase64(jsonStr);
  }

  private generateEmbeddedSection(embeddedFiles?: Record<string, string>): string {
    if (!embeddedFiles || Object.keys(embeddedFiles).length === 0) {
      return '\n';
    }

    const lines: string[] = [];
    for (const [fileId, filename] of Object.entries(embeddedFiles)) {
      lines.push(`${fileId}: [[${filename}]]`);
    }

    return '\n' + lines.join('\n') + '\n';
  }
}
