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
