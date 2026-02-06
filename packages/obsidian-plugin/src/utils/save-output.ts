import type { App } from 'obsidian';
import type { GeneratorOutput } from '@petrify/core';
import * as path from 'path';

export interface SaveOutputOptions {
  readonly outputDir: string;
  readonly outputName: string;
  readonly frontmatter: string;
}

export async function saveGeneratorOutput(
  app: App,
  output: GeneratorOutput,
  options: SaveOutputOptions,
): Promise<string> {
  const { outputDir, outputName, frontmatter } = options;
  const outputPath = path.join(outputDir, `${outputName}${output.extension}`);

  const dir = path.dirname(outputPath);
  if (dir && dir !== '.' && !(await app.vault.adapter.exists(dir))) {
    await app.vault.createFolder(dir);
  }

  if (output.assets.size > 0) {
    const assetsDir = path.join(outputDir, 'assets', outputName);
    if (!(await app.vault.adapter.exists(assetsDir))) {
      await app.vault.createFolder(assetsDir);
    }

    for (const [filename, data] of output.assets) {
      const assetPath = path.join(assetsDir, filename);
      await app.vault.adapter.writeBinary(assetPath, data.buffer as ArrayBuffer);
    }
  }

  const fullContent = frontmatter + output.content;
  if (await app.vault.adapter.exists(outputPath)) {
    await app.vault.adapter.write(outputPath, fullContent);
  } else {
    await app.vault.create(outputPath, fullContent);
  }

  return outputPath;
}
