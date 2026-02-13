import { DEFAULT_CONFIDENCE_THRESHOLD } from './api.js';
import { ConversionError } from './exceptions.js';
import { sha1Hex } from './hash.js';
import type { Note } from './models/note.js';
import { filterOcrByConfidence } from './ocr/filter.js';
import { diffPages } from './page-diff.js';
import type {
  ConversionMetadata,
  ConversionMetadataPort,
  PageHash,
} from './ports/conversion-metadata.js';
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
  private readonly parsersByExtension: Map<string, ParserPort[]>;

  constructor(
    parsers: Map<string, ParserPort | ParserPort[]>,
    private readonly generator: FileGeneratorPort,
    private readonly ocr: OcrPort | null,
    private readonly metadataPort: ConversionMetadataPort,
    private readonly options: PetrifyServiceOptions,
  ) {
    this.parsersByExtension = new Map<string, ParserPort[]>();

    for (const [ext, parserOrParsers] of parsers) {
      const normalizedExt = ext.toLowerCase();
      const entries = Array.isArray(parserOrParsers) ? parserOrParsers : [parserOrParsers];
      if (entries.length === 0) continue;

      const existing = this.parsersByExtension.get(normalizedExt) ?? [];
      for (const parser of entries) {
        if (!existing.includes(parser)) {
          existing.push(parser);
        }
      }
      this.parsersByExtension.set(normalizedExt, existing);
    }
  }

  getParsersForExtension(ext: string): ParserPort[] {
    return [...(this.parsersByExtension.get(ext.toLowerCase()) ?? [])];
  }

  async handleFileChange(
    event: FileChangeEvent,
    parser: ParserPort,
  ): Promise<ConversionResult | null> {
    const supportsExtension = parser.extensions.some(
      (supportedExt) => supportedExt.toLowerCase() === event.extension.toLowerCase(),
    );
    if (!supportsExtension) {
      return null;
    }

    const savedMetadata = await this.metadataPort.getMetadata(event.id);
    if (savedMetadata?.keep) {
      return null;
    }

    const data = await event.readData();
    const fileHash = await sha1Hex(new Uint8Array(data));
    if (savedMetadata?.fileHash === fileHash) {
      return null;
    }

    let note: Note;
    try {
      note = await parser.parse(data);
    } catch (error) {
      throw new ConversionError('parse', error);
    }

    const currentPageHashes = await this.computePageHashes(note);

    const parserChanged = savedMetadata?.parser != null && savedMetadata.parser !== parser.id;
    const diff = diffPages(
      currentPageHashes,
      parserChanged ? null : (savedMetadata?.pageHashes ?? null),
    );
    if (diff.type === 'none') {
      return null;
    }

    const baseName = event.name.replace(/\.[^/.]+$/, '');
    const changedPageIds = new Set([...diff.changed, ...diff.added]);
    const targetPageIds =
      diff.type === 'full' || diff.type === 'structural' ? undefined : changedPageIds;
    const generatorOutput = await this.convertData(note, baseName, targetPageIds);

    const metadata: ConversionMetadata = {
      source: event.id,
      parser: parser.id,
      fileHash,
      pageHashes: currentPageHashes,
      keep: false,
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
    let note: Note;
    try {
      note = await parser.parse(data);
    } catch (error) {
      throw new ConversionError('parse', error);
    }

    const generatorOutput = await this.convertData(note, outputName);
    const pageHashes = await this.computePageHashes(note);
    const fileHash = await sha1Hex(new Uint8Array(data));

    const metadata: ConversionMetadata = {
      source: null,
      parser: parser.id,
      fileHash,
      pageHashes,
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

  private async computePageHashes(note: Note): Promise<PageHash[]> {
    const sorted = [...note.pages].sort((a, b) => a.order - b.order);
    return Promise.all(
      sorted.map(async (page) => ({
        id: page.id,
        hash: await sha1Hex(page.imageData),
      })),
    );
  }

  private async convertData(
    note: Note,
    outputName: string,
    targetPageIds?: Set<string>,
  ): Promise<GeneratorOutput> {
    const ocrResults = await this.runOcr(note, targetPageIds);

    try {
      return await this.generator.generate(note, outputName, ocrResults);
    } catch (error) {
      throw new ConversionError('generate', error);
    }
  }

  private async runOcr(
    note: Note,
    targetPageIds?: Set<string>,
  ): Promise<OcrTextResult[] | undefined> {
    if (!this.ocr) return undefined;

    const ocrPort = this.ocr;
    const threshold = this.options.confidenceThreshold ?? DEFAULT_CONFIDENCE_THRESHOLD;
    const pages = note.pages.filter(
      (page) => page.imageData.length > 0 && (!targetPageIds || targetPageIds.has(page.id)),
    );

    try {
      const results = await Promise.all(
        pages.map(async (page) => {
          const imageBuffer = new Uint8Array(page.imageData).buffer;
          const ocrResult = await ocrPort.recognize(imageBuffer);
          const filteredTexts = filterOcrByConfidence(ocrResult.regions, threshold);
          return { pageId: page.id, pageIndex: page.order, texts: filteredTexts };
        }),
      );
      return results.filter((r) => r.texts.length > 0);
    } catch (error) {
      throw new ConversionError('ocr', error);
    }
  }
}
