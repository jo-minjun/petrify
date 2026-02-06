export class InvalidFileFormatError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidFileFormatError';
  }
}

export class ParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ParseError';
  }
}

export class OcrInitializationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'OcrInitializationError';
  }
}

export class OcrRecognitionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'OcrRecognitionError';
  }
}

export type ConversionPhase = 'parse' | 'ocr' | 'generate' | 'save';

export class ConversionError extends Error {
  readonly phase: ConversionPhase;

  constructor(phase: ConversionPhase, cause: unknown) {
    const message = cause instanceof Error ? cause.message : String(cause);
    super(`Conversion failed at ${phase}: ${message}`);
    this.name = 'ConversionError';
    this.phase = phase;
    this.cause = cause;
  }
}
