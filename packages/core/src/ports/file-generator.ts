import type { Note } from '../models/index.js';
import type { OcrTextResult } from '../excalidraw/md-generator.js';

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

export type { OcrTextResult };
