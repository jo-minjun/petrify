export * from './models/index.js';

export { ExcalidrawGenerator } from './excalidraw/generator.js';
export { ExcalidrawMdGenerator } from './excalidraw/md-generator.js';
export { uint8ArrayToBase64 } from './excalidraw/base64.js';
export type { ExcalidrawData, ExcalidrawElement, ExcalidrawFileEntry } from './excalidraw/generator.js';
export type { OcrTextResult } from './excalidraw/md-generator.js';

export type { ParserPort } from './ports/parser.js';
export type { OcrPort, OcrResult, OcrRegion, OcrOptions } from './ports/ocr.js';
export type { WatcherPort, FileChangeEvent } from './ports/watcher.js';
export type { ConversionStatePort } from './ports/conversion-state.js';

export {
  InvalidFileFormatError,
  ParseError,
  OcrInitializationError,
  OcrRecognitionError,
} from './exceptions.js';

export { convert, convertToMd, convertToMdWithOcr, DEFAULT_CONFIDENCE_THRESHOLD } from './api.js';
export type { ConvertOptions } from './api.js';

export { ConversionPipeline } from './conversion-pipeline.js';
export type { ConversionPipelineOptions } from './conversion-pipeline.js';

export { filterOcrByConfidence } from './ocr/filter.js';
