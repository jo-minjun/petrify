import { ConversionError } from '@petrify/core';

export function formatConversionError(fileName: string, error: unknown): string {
  if (error instanceof ConversionError) {
    switch (error.phase) {
      case 'parse': return `Parse failed: ${fileName}`;
      case 'ocr': return `OCR failed: ${fileName}`;
      case 'generate': return `Generate failed: ${fileName}`;
      case 'save': return `Save failed: ${fileName}`;
    }
  }
  return `Conversion failed: ${fileName}`;
}
