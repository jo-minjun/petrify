export * from './models/index.js';

export { ExcalidrawGenerator } from './excalidraw/generator.js';
export { ExcalidrawMdGenerator } from './excalidraw/md-generator.js';
export type { ExcalidrawData, ExcalidrawElement } from './excalidraw/generator.js';
export type { OcrTextResult } from './excalidraw/md-generator.js';

export type { ParserPort } from './ports/parser.js';
export type { OcrPort, OcrResult, OcrRegion, OcrOptions } from './ports/ocr.js';

export { InvalidNoteFileError, ParseError } from './exceptions.js';

export { convert, convertToMd, convertToMdWithOcr } from './api.js';
export type { ConvertOptions } from './api.js';

export { filterOcrByConfidence } from './ocr/filter.js';
