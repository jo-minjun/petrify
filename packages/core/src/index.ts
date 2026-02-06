export { DEFAULT_CONFIDENCE_THRESHOLD } from './api.js';
export type { ConversionPhase, FileSystemOperation } from './exceptions.js';
export {
  ConversionError,
  FileSystemError,
  InvalidFileFormatError,
  OcrInitializationError,
  OcrRecognitionError,
  ParseError,
} from './exceptions.js';
export * from './models/index.js';
export { filterOcrByConfidence } from './ocr/filter.js';
export type { PetrifyServiceOptions } from './petrify-service.js';
export { PetrifyService } from './petrify-service.js';
export type { ConversionMetadata, ConversionMetadataPort } from './ports/conversion-metadata.js';
export type {
  FileGeneratorPort,
  GeneratorOutput,
  OcrTextResult,
} from './ports/file-generator.js';
export type { FileSystemPort } from './ports/file-system.js';
export type { OcrOptions, OcrPort, OcrRegion, OcrResult } from './ports/ocr.js';
export type { ParserPort } from './ports/parser.js';
export type { FileChangeEvent, FileDeleteEvent, WatcherPort } from './ports/watcher.js';
