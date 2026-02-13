import type { Note, ParserPort } from '@petrify/core';
import { NoteParser } from './parser.js';

export class SupernoteXParser implements ParserPort {
  readonly extensions = ['.note'];

  private readonly parser = new NoteParser();

  constructor(readonly id: string) {}

  parse(data: ArrayBuffer): Promise<Note> {
    return this.parser.parse(data);
  }
}

export { InvalidFileFormatError, ParseError } from './exceptions.js';
export { NoteParser } from './parser.js';
