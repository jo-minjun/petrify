import type { ParserPort } from './ports/parser.js';
import type { OcrPort } from './ports/ocr.js';
import type { ConversionStatePort } from './ports/conversion-state.js';
import type { FileChangeEvent } from './ports/watcher.js';
import type { FileGeneratorPort, GeneratorOutput, OcrTextResult } from './ports/file-generator.js';
import { filterOcrByConfidence } from './ocr/filter.js';
import { DEFAULT_CONFIDENCE_THRESHOLD } from './api.js';

export interface ConversionPipelineOptions {
  readonly confidenceThreshold: number;
}

export class ConversionPipeline {
  private readonly parserMap: Map<string, ParserPort>;

  constructor(
    parsers: Map<string, ParserPort>,
    private readonly generator: FileGeneratorPort,
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

  async convertDroppedFile(
    data: ArrayBuffer,
    parser: ParserPort,
    outputName: string,
  ): Promise<GeneratorOutput> {
    return this.convertData(data, parser, outputName);
  }

  async handleFileChange(event: FileChangeEvent): Promise<GeneratorOutput | null> {
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
    const baseName = event.name.replace(/\.[^/.]+$/, '');
    return this.convertData(data, parser, baseName);
  }

  private async convertData(
    data: ArrayBuffer,
    parser: ParserPort,
    outputName: string,
  ): Promise<GeneratorOutput> {
    const note = await parser.parse(data);
    const threshold = this.options.confidenceThreshold ?? DEFAULT_CONFIDENCE_THRESHOLD;

    let ocrResults: OcrTextResult[] | undefined;

    if (this.ocr) {
      ocrResults = [];
      for (const page of note.pages) {
        if (page.imageData.length === 0) continue;

        const imageBuffer = new Uint8Array(page.imageData).buffer;
        const ocrResult = await this.ocr.recognize(imageBuffer);
        const filteredTexts = filterOcrByConfidence(ocrResult.regions, threshold);

        if (filteredTexts.length > 0) {
          ocrResults.push({ pageIndex: page.order, texts: filteredTexts });
        }
      }
    }

    return this.generator.generate(note, outputName, ocrResults);
  }
}
