import { DEFAULT_CONFIDENCE_THRESHOLD } from './api.js';
import { ConversionError } from './exceptions.js';
import type { Note } from './models/note.js';
import { filterOcrByConfidence } from './ocr/filter.js';
import type { ConversionMetadata, ConversionMetadataPort } from './ports/conversion-metadata.js';
import type { FileGeneratorPort, GeneratorOutput, OcrTextResult } from './ports/file-generator.js';
import type { OcrPort } from './ports/ocr.js';
import type { ParserPort } from './ports/parser.js';
import type { FileChangeEvent } from './ports/watcher.js';

export interface PetrifyServiceOptions {
  readonly confidenceThreshold: number;
}

export interface ConversionResult {
  readonly content: string;
  readonly assets: ReadonlyMap<string, Uint8Array>;
  readonly metadata: ConversionMetadata;
}

export class PetrifyService {
  constructor(
    private readonly parsers: Map<string, ParserPort>,
    private readonly generator: FileGeneratorPort,
    private readonly ocr: OcrPort | null,
    private readonly metadataPort: ConversionMetadataPort,
    private readonly options: PetrifyServiceOptions,
  ) {}

  getParsersForExtension(ext: string): ParserPort[] {
    const parser = this.parsers.get(ext.toLowerCase());
    return parser ? [parser] : [];
  }

  async handleFileChange(event: FileChangeEvent): Promise<ConversionResult | null> {
    const parser = this.parsers.get(event.extension.toLowerCase());
    if (!parser) {
      return null;
    }

    const lastMetadata = await this.metadataPort.getMetadata(event.id);
    if (lastMetadata?.mtime != null && event.mtime <= lastMetadata.mtime) {
      return null;
    }

    const data = await event.readData();
    const baseName = event.name.replace(/\.[^/.]+$/, '');
    const generatorOutput = await this.convertData(data, parser, baseName);

    const metadata: ConversionMetadata = {
      source: event.id,
      mtime: event.mtime,
    };

    return {
      content: generatorOutput.content,
      assets: generatorOutput.assets ?? new Map(),
      metadata,
    };
  }

  async convertDroppedFile(
    data: ArrayBuffer,
    parser: ParserPort,
    outputName: string,
  ): Promise<ConversionResult> {
    const generatorOutput = await this.convertData(data, parser, outputName);

    const metadata: ConversionMetadata = {
      source: null,
      mtime: null,
      keep: true,
    };

    return {
      content: generatorOutput.content,
      assets: generatorOutput.assets ?? new Map(),
      metadata,
    };
  }

  async handleFileDelete(outputPath: string): Promise<boolean> {
    const metadata = await this.metadataPort.getMetadata(outputPath);

    if (!metadata) return false;
    if (metadata.keep) return false;

    return true;
  }

  private async convertData(
    data: ArrayBuffer,
    parser: ParserPort,
    outputName: string,
  ): Promise<GeneratorOutput> {
    let note: Note;
    try {
      note = await parser.parse(data);
    } catch (error) {
      throw new ConversionError('parse', error);
    }

    const threshold = this.options.confidenceThreshold ?? DEFAULT_CONFIDENCE_THRESHOLD;

    let ocrResults: OcrTextResult[] | undefined;

    if (this.ocr) {
      const ocrPages = note.pages.filter((page) => page.imageData.length > 0);
      try {
        const results = await Promise.all(
          ocrPages.map(async (page) => {
            const imageBuffer = new Uint8Array(page.imageData).buffer;
            const ocrResult = await this.ocr!.recognize(imageBuffer);
            const filteredTexts = filterOcrByConfidence(ocrResult.regions, threshold);
            return { pageIndex: page.order, texts: filteredTexts };
          }),
        );
        ocrResults = results.filter((r) => r.texts.length > 0);
      } catch (error) {
        throw new ConversionError('ocr', error);
      }
    }

    try {
      return this.generator.generate(note, outputName, ocrResults);
    } catch (error) {
      throw new ConversionError('generate', error);
    }
  }
}
