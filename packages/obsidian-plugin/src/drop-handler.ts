import * as path from 'path';
import type { App } from 'obsidian';
import { ConversionError } from '@petrify/core';
import type { PetrifyService, ParserPort } from '@petrify/core';
import { createLogger } from './logger.js';
import { ParserSelectModal } from './parser-select-modal.js';

const log = createLogger('Drop');

export class DropHandler {
  private readonly parserChoices = new Map<string, ParserPort>();

  constructor(
    private readonly app: App,
    private readonly petrifyService: PetrifyService,
    private readonly parserMap: Map<string, ParserPort>,
  ) {}

  handleDrop = async (evt: DragEvent): Promise<void> => {
    const target = evt.target as HTMLElement;
    if (!this.isFileExplorer(target)) return;

    const files = evt.dataTransfer?.files;
    if (!files || files.length === 0) return;

    const supportedFiles = this.filterSupportedFiles(files);
    if (supportedFiles.length === 0) return;

    evt.preventDefault();
    evt.stopPropagation();

    const dropFolder = this.resolveDropFolder(target);

    let converted = 0;
    let failed = 0;

    for (const file of supportedFiles) {
      try {
        const ext = path.extname(file.name).toLowerCase();
        const cached = this.parserChoices.get(ext);
        const parser = cached ?? await this.resolveParser(file.name, ext);
        if (!parser) continue;

        const data = await file.arrayBuffer();
        const baseName = path.basename(file.name, ext);
        const outputPath = await this.petrifyService.convertDroppedFile(data, parser, dropFolder, baseName);

        converted++;
        log.info(`Converted: ${file.name} -> ${outputPath}`);
      } catch (error) {
        failed++;
        if (error instanceof ConversionError) {
          log.error(`${error.phase} failed: ${file.name}`, error);
        } else {
          log.error(`Conversion failed: ${file.name}`, error);
        }
      }
    }

    if (converted > 0 || failed > 0) {
      log.notify(`Drop: ${converted} converted, ${failed} failed`);
    }
  };

  private isFileExplorer(target: HTMLElement): boolean {
    return target.closest('.nav-files-container') !== null;
  }

  private resolveDropFolder(target: HTMLElement): string {
    const navFolder = target.closest('[data-path]') as HTMLElement | null;
    if (navFolder) {
      const dataPath = navFolder.getAttribute('data-path');
      if (dataPath !== null) return dataPath;
    }
    return '';
  }

  private filterSupportedFiles(files: FileList): File[] {
    return Array.from(files).filter((file) => {
      const ext = path.extname(file.name).toLowerCase();
      return this.petrifyService.getParsersForExtension(ext).length > 0;
    });
  }

  private async resolveParser(
    fileName: string,
    ext: string,
  ): Promise<ParserPort | undefined> {
    const parsers = this.petrifyService.getParsersForExtension(ext);
    if (parsers.length === 0) return undefined;
    if (parsers.length === 1) return parsers[0];

    const parserEntries = parsers.map((parser) => {
      for (const [id, p] of this.parserMap) {
        if (p === parser) return { id, parser };
      }
      return { id: 'unknown', parser };
    });

    const modal = new ParserSelectModal(this.app, fileName, ext, parserEntries);
    modal.open();
    const result = await modal.waitForSelection();

    if (!result) return undefined;
    if (result.applyToAll) {
      this.parserChoices.set(ext, result.parser);
    }
    return result.parser;
  }
}
