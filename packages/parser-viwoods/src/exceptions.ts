// src/exceptions.ts
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
