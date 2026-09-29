import type { ParserPort } from '@petrify/core';
import { PdfParser } from '@petrify/parser-pdf';
import { SupernoteXParser } from '@petrify/parser-supernote-x';
import { ViwoodsParser } from '@petrify/parser-viwoods';
import { loadPdfJs } from 'obsidian';

type PdfLoader = NonNullable<ConstructorParameters<typeof PdfParser>[1]>;

interface PdfJs {
  getDocument(options: {
    data: Uint8Array;
    useWorkerFetch: boolean;
    isEvalSupported: boolean;
  }): Awaited<ReturnType<PdfLoader>>;
}

const loadObsidianPdf: PdfLoader = async (data) => {
  // Obsidian supplies PDF.js with its matching worker already configured.
  const pdfjs: PdfJs = await loadPdfJs();
  return pdfjs.getDocument({ data, useWorkerFetch: false, isEvalSupported: false });
};

export enum ParserId {
  Viwoods = 'viwoods',
  Pdf = 'pdf',
  SupernoteX = 'supernote-x',
}

export function createParserMap(): Map<string, ParserPort> {
  return new Map<string, ParserPort>([
    [ParserId.Viwoods, new ViwoodsParser(ParserId.Viwoods)],
    [ParserId.Pdf, new PdfParser(ParserId.Pdf, loadObsidianPdf)],
    [ParserId.SupernoteX, new SupernoteXParser(ParserId.SupernoteX)],
  ]);
}
