import type { Note, ParserPort } from '@petrify/core';
import { NoteParser } from './parser';

export class ViwoodsParser implements ParserPort {
  readonly extensions = ['.note'];

  private parser = new NoteParser();

  async parse(data: ArrayBuffer): Promise<Note> {
    return this.parser.parse(data);
  }
}

export { NoteParser } from './parser';
export { ColorExtractor } from './color-extractor';
export { InvalidNoteFileError, ParseError } from './exceptions';
