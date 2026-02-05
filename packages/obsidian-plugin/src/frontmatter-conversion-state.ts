import type { ConversionStatePort } from '@petrify/core';
import { parseFrontmatter } from './utils/frontmatter.js';

export class FrontmatterConversionState implements ConversionStatePort {
  constructor(
    private readonly readFile: (path: string) => Promise<string>,
  ) {}

  async getLastConvertedMtime(id: string): Promise<number | undefined> {
    try {
      const content = await this.readFile(id);
      const meta = parseFrontmatter(content);
      return meta?.mtime;
    } catch {
      return undefined;
    }
  }
}
