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
): Promise<boolean> {
  const result = await petrifyService.handleFileChange(event, parser);
  if (!result) return false;

  const baseName = event.name.replace(/\.[^/.]+$/, '');
  const outputPath = await save(result, outputDir, baseName);
  log.info(`Converted: ${event.name} -> ${outputPath}`);
  return true;
}
