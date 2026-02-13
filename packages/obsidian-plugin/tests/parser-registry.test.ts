import { PdfParser } from '@petrify/parser-pdf';
import { ViwoodsParser } from '@petrify/parser-viwoods';
import { describe, expect, it } from 'vitest';
import { createParserMap, ParserId } from '../src/parser-registry.js';

describe('createParserMap', () => {
  it('registers viwoods and pdf parsers', () => {
    const parserMap = createParserMap();

    expect(parserMap.get(ParserId.Viwoods)).toBeInstanceOf(ViwoodsParser);
    expect(parserMap.get(ParserId.Pdf)).toBeInstanceOf(PdfParser);
  });
});
