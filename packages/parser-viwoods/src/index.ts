import type { Note, ParserPort } from '@petrify/core';
import { NoteParser } from './parser.js';

export class ViwoodsParser implements ParserPort {
  readonly extensions = ['.note'];

  private readonly parser = new NoteParser();

  async parse(data: ArrayBuffer): Promise<Note> {
    return this.parser.parse(data);
  }
}

export { NoteParser } from './parser.js';
export { ColorExtractor } from './color-extractor.js';
export { InvalidNoteFileError, ParseError } from './exceptions.js';
