export class InvalidNoteFileError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidNoteFileError';
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
