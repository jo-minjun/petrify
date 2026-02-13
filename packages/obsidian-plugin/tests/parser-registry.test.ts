import { PdfParser } from '@petrify/parser-pdf';
import { SupernoteXParser } from '@petrify/parser-supernote-x';
import { ViwoodsParser } from '@petrify/parser-viwoods';
import { describe, expect, it } from 'vitest';
import { createParserMap, ParserId } from '../src/parser-registry.js';

describe('createParserMap', () => {
  it('registers viwoods, pdf, and supernote-x parsers', () => {
    const parserMap = createParserMap();

    expect(parserMap.get(ParserId.Viwoods)).toBeInstanceOf(ViwoodsParser);
    expect(parserMap.get(ParserId.Pdf)).toBeInstanceOf(PdfParser);
    expect(parserMap.get(ParserId.SupernoteX)).toBeInstanceOf(SupernoteXParser);
  });
});
