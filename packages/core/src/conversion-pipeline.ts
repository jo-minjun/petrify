import type { ParserPort } from './ports/parser.js';
import type { OcrPort } from './ports/ocr.js';
import type { ConversionStatePort } from './ports/conversion-state.js';
import type { FileChangeEvent } from './ports/watcher.js';
import { convertToMd, convertToMdWithOcr } from './api.js';

export interface ConversionPipelineOptions {
  readonly confidenceThreshold: number;
}

export class ConversionPipeline {
  private readonly parserMap: Map<string, ParserPort>;

  constructor(
    parsers: Map<string, ParserPort>,
    private readonly ocr: OcrPort | null,
    private readonly conversionState: ConversionStatePort,
    private readonly options: ConversionPipelineOptions,
  ) {
    this.parserMap = parsers;
  }

  getParsersForExtension(ext: string): ParserPort[] {
    const parser = this.parserMap.get(ext.toLowerCase());
    return parser ? [parser] : [];
  }

  async handleFileChange(event: FileChangeEvent): Promise<string | null> {
    const parser = this.parserMap.get(event.extension.toLowerCase());
    if (!parser) {
      console.log(`[Petrify:Convert] Skipped (unsupported): ${event.name}`);
      return null;
    }

    const lastMtime = await this.conversionState.getLastConvertedMtime(event.id);
    if (lastMtime !== undefined && event.mtime <= lastMtime) {
      console.log(`[Petrify:Convert] Skipped (up-to-date): ${event.name}`);
      return null;
    }

    const data = await event.readData();

    if (this.ocr) {
      return convertToMdWithOcr(data, parser, this.ocr, {
        ocrConfidenceThreshold: this.options.confidenceThreshold,
      });
    }

    return convertToMd(data, parser);
  }
}
