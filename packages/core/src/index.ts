export { DEFAULT_CONFIDENCE_THRESHOLD } from './api.js';
export type { ConversionPhase } from './exceptions.js';
export {
  ConversionError,
  InvalidFileFormatError,
  OcrInitializationError,
  OcrRecognitionError,
  ParseError,
  WatcherAuthError,
  WatcherSourceError,
} from './exceptions.js';
export { sha1Hex } from './hash.js';
export * from './models/index.js';
export { filterOcrByConfidence } from './ocr/filter.js';
export { mergeOcrResults } from './ocr/merge.js';
export { parsePageMarkers } from './ocr/page-marker-parser.js';
export { type DiffType, diffPages, type PageDiff } from './page-diff.js';
export type { ConversionResult, PetrifyServiceOptions } from './petrify-service.js';
export { PetrifyService } from './petrify-service.js';
export type {
  ConversionMetadata,
  ConversionMetadataPort,
  PageHash,
} from './ports/conversion-metadata.js';
export type {
  FileGeneratorPort,
  GeneratorOutput,
  IncrementalInput,
  OcrTextResult,
  PageUpdate,
} from './ports/file-generator.js';
export type { OcrOptions, OcrPort, OcrRegion, OcrResult } from './ports/ocr.js';
export type { ParserPort } from './ports/parser.js';
export type { FileChangeEvent, FileDeleteEvent, WatcherPort } from './ports/watcher.js';
