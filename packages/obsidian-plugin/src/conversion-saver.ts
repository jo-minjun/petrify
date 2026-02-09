import * as path from 'node:path';
import type { ConversionMetadata, ConversionResult } from '@petrify/core';
import { ConversionError } from '@petrify/core';

export interface FileWriter {
  writeFile(filePath: string, content: string): Promise<void>;
  writeAsset(dir: string, name: string, data: Uint8Array): Promise<void>;
}

export interface MetadataFormatter {
  formatMetadata(metadata: ConversionMetadata): string;
}

export async function saveConversionResult(
  result: ConversionResult,
  outputDir: string,
  baseName: string,
  extension: string,
  fileWriter: FileWriter,
  metadataFormatter: MetadataFormatter,
): Promise<string> {
  try {
    const outputPath = path.posix.join(outputDir, `${baseName}${extension}`);
    const frontmatter = metadataFormatter.formatMetadata(result.metadata);

    await fileWriter.writeFile(outputPath, frontmatter + result.content);

    if (result.assets.size > 0) {
      const assetsDir = path.posix.join(outputDir, 'assets', baseName);
      for (const [assetName, data] of result.assets) {
        await fileWriter.writeAsset(assetsDir, assetName, data);
      }
    }

    return outputPath;
  } catch (error) {
    if (error instanceof ConversionError) throw error;
    throw new ConversionError('save', error);
  }
}
