import type { ConversionResult, FileChangeEvent, ParserPort, PetrifyService } from '@petrify/core';
import type { Logger } from './logger.js';

export type SaveFn = (
  result: ConversionResult,
  outputDir: string,
  baseName: string,
) => Promise<string>;

export async function processFile(
  event: FileChangeEvent,
  outputDir: string,
  petrifyService: PetrifyService,
  save: SaveFn,
  log: Logger,
  parser: ParserPort,
  outputExtension = '.excalidraw.md',
): Promise<boolean> {
  const baseName = event.name.replace(/\.[^/.]+$/, '');
  const outputPath = path.posix.join(outputDir, `${baseName}${outputExtension}`);
  const result = await petrifyService.handleFileChange(event, parser, outputPath);
  if (!result) return false;

  const savedPath = await save(result, outputDir, baseName);
  log.info(`Converted: ${event.name} -> ${savedPath}`);
  return true;
}

import * as path from 'node:path';
