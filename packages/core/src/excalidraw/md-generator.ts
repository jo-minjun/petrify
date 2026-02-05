import LZString from 'lz-string';
import type { ExcalidrawData } from './generator.js';

export interface OcrTextResult {
  pageIndex: number;
  texts: string[];
}

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

  /**
   * OCR 결과를 ## OCR Text 섹션으로 포맷팅
   *
   * 현재 구현: back-of-note 영역에 텍스트만 추가 (캔버스에 안 보임, Obsidian 검색 가능)
   *
   * TODO: 향후 옵션으로 text 요소를 elements에 추가하는 방식 지원 고려
   * - elements 배열에 type: 'text' 요소 추가
   * - opacity: 0 또는 캔버스 밖 좌표로 숨김 처리
   * - ## Text Elements 섹션에도 표시되어 Excalidraw 내부 검색 가능
   *
   * @example
   * // elements에 추가하는 방식 (미구현)
   * const textElement = {
   *   type: 'text',
   *   id: nanoid(),
   *   text: ocrText,
   *   x: -99999,  // 캔버스 밖
   *   y: -99999,
   *   opacity: 0,
   *   // ... 기타 필수 속성
   * };
   */
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
