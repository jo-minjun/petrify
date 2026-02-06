import type { Note } from '../models/index.js';

export interface OcrTextResult {
  pageIndex: number;
  texts: string[];
}

export interface GeneratorOutput {
  readonly content: string;
  readonly assets: ReadonlyMap<string, Uint8Array>;
  readonly extension: string;
}

export interface FileGeneratorPort {
  readonly id: string;
  readonly displayName: string;
  generate(note: Note, outputName: string, ocrResults?: OcrTextResult[]): GeneratorOutput;
}
