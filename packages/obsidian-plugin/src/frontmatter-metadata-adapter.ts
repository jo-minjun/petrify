import type { ConversionMetadataPort, ConversionMetadata } from '@petrify/core';
import { parseFrontmatter, createFrontmatter } from './utils/frontmatter.js';

export class FrontmatterMetadataAdapter implements ConversionMetadataPort {
  constructor(
    private readonly readFile: (path: string) => Promise<string>,
  ) {}

  async getMetadata(id: string): Promise<ConversionMetadata | undefined> {
    try {
      const content = await this.readFile(id);
      const meta = parseFrontmatter(content);
      if (!meta) return undefined;

      return {
        source: meta.source,
        mtime: meta.mtime,
        keep: meta.keep,
      };
    } catch {
      return undefined;
    }
  }

  formatMetadata(metadata: ConversionMetadata): string {
    return createFrontmatter({
      source: metadata.source,
      mtime: metadata.mtime,
      keep: metadata.keep,
    });
  }
}
