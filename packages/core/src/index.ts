export { DEFAULT_CONFIDENCE_THRESHOLD } from './api.js';
export type { ConversionPhase } from './exceptions.js';
export {
  ConversionError,
  InvalidFileFormatError,
  OcrInitializationError,
  OcrRecognitionError,
  ParseError,
} from './exceptions.js';
export * from './models/index.js';
export { filterOcrByConfidence } from './ocr/filter.js';
export type { ConversionResult, PetrifyServiceOptions } from './petrify-service.js';
export { PetrifyService } from './petrify-service.js';
export type { ConversionMetadata, ConversionMetadataPort } from './ports/conversion-metadata.js';
export type {
  FileGeneratorPort,
  GeneratorOutput,
  OcrTextResult,
} from './ports/file-generator.js';
export type { OcrOptions, OcrPort, OcrRegion, OcrResult } from './ports/ocr.js';
export type { ParserPort } from './ports/parser.js';
export type { FileChangeEvent, FileDeleteEvent, WatcherPort } from './ports/watcher.js';
