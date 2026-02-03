import type { ParserPort } from '@petrify/core';

export class ParserRegistry {
  private readonly parsers: Map<string, ParserPort> = new Map();

  register(parser: ParserPort): void {
    for (const ext of parser.extensions) {
      this.parsers.set(ext.toLowerCase(), parser);
    }
  }

  getParserForExtension(extension: string): ParserPort | undefined {
    return this.parsers.get(extension.toLowerCase());
  }

  getSupportedExtensions(): string[] {
    return Array.from(this.parsers.keys());
  }
}
