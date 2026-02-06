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
export type { FileSystemPort } from './ports/file-system.js';

export {
  InvalidFileFormatError,
  ParseError,
  OcrInitializationError,
  OcrRecognitionError,
  ConversionError,
  FileSystemError,
} from './exceptions.js';
export type { ConversionPhase, FileSystemOperation } from './exceptions.js';

export { DEFAULT_CONFIDENCE_THRESHOLD } from './api.js';

export { PetrifyService } from './petrify-service.js';
export type { PetrifyServiceOptions } from './petrify-service.js';

export { filterOcrByConfidence } from './ocr/filter.js';
