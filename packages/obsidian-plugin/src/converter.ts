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
    private readonly ocr: OcrPort,
    private readonly options: ConverterOptions
  ) {}

  async convert(data: ArrayBuffer, extension: string, meta: ConvertMeta): Promise<string> {
    const parser = this.parserRegistry.getParserForExtension(extension);
    if (!parser) {
      throw new Error(`Unsupported file extension: ${extension}`);
    }

    const mdContent = await convertToMdWithOcr(data, parser, this.ocr, {
      ocrConfidenceThreshold: this.options.confidenceThreshold,
    });

    const frontmatter = createFrontmatter({
      source: meta.sourcePath,
      mtime: meta.mtime,
    });

    return frontmatter + mdContent;
  }
}
