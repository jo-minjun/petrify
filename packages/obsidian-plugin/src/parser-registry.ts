import type { ParserPort } from '@petrify/core';
import { ViwoodsParser } from '@petrify/parser-viwoods';

export enum ParserId {
  Viwoods = 'viwoods',
}

export function createParserMap(): Map<string, ParserPort> {
  return new Map<string, ParserPort>([
    [ParserId.Viwoods, new ViwoodsParser()],
  ]);
}
