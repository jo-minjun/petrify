import type { ParserPort } from '@petrify/core';
import { PdfParser } from '@petrify/parser-pdf';
import { ViwoodsParser } from '@petrify/parser-viwoods';

export enum ParserId {
  Viwoods = 'viwoods',
  Pdf = 'pdf',
}

export function createParserMap(): Map<string, ParserPort> {
  return new Map<string, ParserPort>([
    [ParserId.Viwoods, new ViwoodsParser()],
    [ParserId.Pdf, new PdfParser()],
  ]);
}
