import type { Note } from '../models/index.js';

export interface ParserPort {
  /** Supported file extensions */
  readonly extensions: string[];

  /** Parse file data into a Note model */
  parse(data: ArrayBuffer): Promise<Note>;
}
