import type { ParserPort } from '@petrify/core';
import { PdfParser } from '@petrify/parser-pdf';
import { SupernoteXParser } from '@petrify/parser-supernote-x';
import { ViwoodsParser } from '@petrify/parser-viwoods';

export enum ParserId {
  Viwoods = 'viwoods',
  Pdf = 'pdf',
  SupernoteX = 'supernote-x',
}

export function createParserMap(): Map<string, ParserPort> {
  return new Map<string, ParserPort>([
    [ParserId.Viwoods, new ViwoodsParser()],
    [ParserId.Pdf, new PdfParser()],
    [ParserId.SupernoteX, new SupernoteXParser()],
  ]);
}
