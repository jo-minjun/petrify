import type { Note } from '../models/index.js';
import type { Page } from '../models/page.js';

export interface OcrTextResult {
  pageId: string;
  pageIndex: number;
  texts: string[];
}

export interface PageUpdate {
  readonly page: Page;
  readonly ocrResult?: OcrTextResult;
}

export interface IncrementalInput {
  readonly existingContent: string;
  readonly existingAssets: ReadonlyMap<string, Uint8Array>;
  readonly updates: ReadonlyMap<string, PageUpdate>;
  readonly removedPageIds: readonly string[];
}

export interface GeneratorOutput {
  readonly content: string;
  readonly assets: ReadonlyMap<string, Uint8Array>;
  readonly extension: string;
}

export interface FileGeneratorPort {
  readonly id: string;
  readonly displayName: string;
  readonly extension: string;
  generate(
    note: Note,
    outputName: string,
    ocrResults?: OcrTextResult[],
  ): GeneratorOutput | Promise<GeneratorOutput>;
  incrementalUpdate(
    input: IncrementalInput,
    note: Note,
    outputName: string,
  ): GeneratorOutput | Promise<GeneratorOutput>;
}
