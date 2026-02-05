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
    parsers: ParserPort[],
    private readonly ocr: OcrPort | null,
    private readonly conversionState: ConversionStatePort,
    private readonly options: ConversionPipelineOptions,
  ) {
    this.parserMap = new Map();
    for (const parser of parsers) {
      for (const ext of parser.extensions) {
        this.parserMap.set(ext.toLowerCase(), parser);
      }
    }
  }

  async handleFileChange(event: FileChangeEvent): Promise<string | null> {
    const parser = this.parserMap.get(event.extension.toLowerCase());
    if (!parser) return null;

    const lastMtime = await this.conversionState.getLastConvertedMtime(event.id);
    if (lastMtime !== undefined && event.mtime <= lastMtime) return null;

    const data = await event.readData();

    if (this.ocr) {
      return convertToMdWithOcr(data, parser, this.ocr, {
        ocrConfidenceThreshold: this.options.confidenceThreshold,
      });
    }

    return convertToMd(data, parser);
  }
}
