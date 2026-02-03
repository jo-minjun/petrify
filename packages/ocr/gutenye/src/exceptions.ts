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
