import type { App } from 'obsidian';
import * as path from 'path';

export async function saveToVault(
  app: App,
  outputPath: string,
  content: string,
): Promise<void> {
  const dir = path.dirname(outputPath);
  if (dir && dir !== '.' && !(await app.vault.adapter.exists(dir))) {
    await app.vault.createFolder(dir);
  }
  if (await app.vault.adapter.exists(outputPath)) {
    await app.vault.adapter.write(outputPath, content);
  } else {
    await app.vault.create(outputPath, content);
  }
}
