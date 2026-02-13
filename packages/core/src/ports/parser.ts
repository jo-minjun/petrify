import type { Note } from '../models/index.js';

export interface ParserPort {
  /** Unique identifier for this parser */
  readonly id: string;

  /** Supported file extensions */
  readonly extensions: string[];

  /** Parse file data into a Note model */
  parse(data: ArrayBuffer): Promise<Note>;
}
