import type { ConversionMetadata, ConversionMetadataPort } from '@petrify/core';
import { createFrontmatter, parseFrontmatter } from './utils/frontmatter.js';

export class FrontmatterMetadataAdapter implements ConversionMetadataPort {
  constructor(private readonly readFile: (path: string) => Promise<string>) {}

  async getMetadata(id: string): Promise<ConversionMetadata | undefined> {
    try {
      const content = await this.readFile(id);
      const meta = parseFrontmatter(content);
      if (!meta) return undefined;

      return {
        source: meta.source,
        parser: meta.parser,
        fileHash: meta.fileHash,
        pageHashes: meta.pageHashes,
        keep: meta.keep,
      };
    } catch {
      return undefined;
    }
  }

  formatMetadata(metadata: ConversionMetadata): string {
    return createFrontmatter({
      source: metadata.source,
      parser: metadata.parser,
      fileHash: metadata.fileHash,
      pageHashes: metadata.pageHashes,
      keep: metadata.keep,
    });
  }
}
