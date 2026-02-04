import { convertToMdWithOcr } from '@petrify/core';
import type { OcrPort } from '@petrify/core';
import type { ParserRegistry } from './parser-registry.js';
import { createFrontmatter } from './utils/frontmatter.js';

export interface ConvertMeta {
  sourcePath: string;
  mtime: number;
}

export interface ConverterOptions {
  confidenceThreshold: number;
}

export class Converter {
  constructor(
    private readonly parserRegistry: ParserRegistry,
    private readonly ocr: OcrPort | null,
    private readonly options: ConverterOptions
  ) {}

  async convert(data: ArrayBuffer, extension: string, meta: ConvertMeta): Promise<string> {
    const parser = this.parserRegistry.getParserForExtension(extension);
    if (!parser) {
      throw new Error(`Unsupported file extension: ${extension}`);
    }

    // TODO(2026-02-04, minjun.jo): OCR 없으면 텍스트 추출 없이 변환
    const mdContent = await convertToMdWithOcr(data, parser, this.ocr!, {
      ocrConfidenceThreshold: this.options.confidenceThreshold,
    });

    const frontmatter = createFrontmatter({
      source: meta.sourcePath,
      mtime: meta.mtime,
    });

    return frontmatter + mdContent;
  }
}
