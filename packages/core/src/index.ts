export * from './models/index.js';

export type { ParserPort } from './ports/parser.js';
export type { OcrPort, OcrResult, OcrRegion, OcrOptions } from './ports/ocr.js';
export type { WatcherPort, FileChangeEvent, FileDeleteEvent } from './ports/watcher.js';
export type {
  FileGeneratorPort,
  GeneratorOutput,
  OcrTextResult,
} from './ports/file-generator.js';
export type { ConversionMetadata, ConversionMetadataPort } from './ports/conversion-metadata.js';

export {
  InvalidFileFormatError,
  ParseError,
  OcrInitializationError,
  OcrRecognitionError,
  ConversionError,
} from './exceptions.js';
export type { ConversionPhase } from './exceptions.js';

export { DEFAULT_CONFIDENCE_THRESHOLD } from './api.js';

export { PetrifyService } from './petrify-service.js';
export type { PetrifyServiceOptions, ConversionResult } from './petrify-service.js';

export { filterOcrByConfidence } from './ocr/filter.js';
