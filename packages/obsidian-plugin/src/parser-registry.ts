import type { ParserPort } from '@petrify/core';
import { SupernoteXParser } from '@petrify/parser-supernote-x';
import { ViwoodsParser } from '@petrify/parser-viwoods';

export enum ParserId {
  Viwoods = 'viwoods',
  SupernoteX = 'supernote-x',
}

export function createParserMap(): Map<string, ParserPort> {
  return new Map<string, ParserPort>([
    [ParserId.Viwoods, new ViwoodsParser()],
    [ParserId.SupernoteX, new SupernoteXParser()],
  ]);
}
