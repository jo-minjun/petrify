import type { ParserPort } from './ports/parser.js';
import type { OcrPort } from './ports/ocr.js';
import type { ConversionMetadataPort, ConversionMetadata } from './ports/conversion-metadata.js';
import type { FileSystemPort } from './ports/file-system.js';
import type { FileChangeEvent } from './ports/watcher.js';
import type { FileGeneratorPort, GeneratorOutput, OcrTextResult } from './ports/file-generator.js';
import { filterOcrByConfidence } from './ocr/filter.js';
import { DEFAULT_CONFIDENCE_THRESHOLD } from './api.js';

export interface PetrifyServiceOptions {
  readonly confidenceThreshold: number;
}

export class PetrifyService {
  constructor(
    private readonly parsers: Map<string, ParserPort>,
    private readonly generator: FileGeneratorPort,
    private readonly ocr: OcrPort | null,
    private readonly metadataPort: ConversionMetadataPort,
    private readonly fileSystem: FileSystemPort,
    private readonly options: PetrifyServiceOptions,
  ) {}

  getParsersForExtension(ext: string): ParserPort[] {
    const parser = this.parsers.get(ext.toLowerCase());
    return parser ? [parser] : [];
  }

  async handleFileChange(event: FileChangeEvent, outputDir: string): Promise<string | null> {
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
    const result = await this.convertData(data, parser, baseName);

    const metadata: ConversionMetadata = {
      source: event.id,
      mtime: event.mtime,
    };

    return this.saveOutput(result, outputDir, baseName, metadata);
  }

  async convertDroppedFile(
    data: ArrayBuffer,
    parser: ParserPort,
    outputDir: string,
    outputName: string,
  ): Promise<string> {
    const result = await this.convertData(data, parser, outputName);

    const metadata: ConversionMetadata = {
      source: null,
      mtime: null,
      keep: true,
    };

    return this.saveOutput(result, outputDir, outputName, metadata);
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

  private async saveOutput(
    result: GeneratorOutput,
    outputDir: string,
    outputName: string,
    metadata: ConversionMetadata,
  ): Promise<string> {
    const frontmatter = this.metadataPort.formatMetadata(metadata);
    const outputPath = `${outputDir}/${outputName}${this.generator.extension}`;

    const content = frontmatter + result.content;
    await this.fileSystem.writeFile(outputPath, content);

    if (result.assets && result.assets.size > 0) {
      const assetsDir = `${outputDir}/assets/${outputName}`;
      for (const [name, data] of result.assets) {
        await this.fileSystem.writeAsset(assetsDir, name, data);
      }
    }

    return outputPath;
  }
}
