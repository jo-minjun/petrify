import type { App } from 'obsidian';
import type { ParserPort, ConversionPipeline } from '@petrify/core';
import { ParserSelectModal } from './parser-select-modal.js';
import type { ParserSelectResult } from './parser-select-modal.js';
import { createFrontmatter } from './utils/frontmatter.js';
import { createLogger } from './logger.js';
import * as path from 'path';

const log = createLogger('Drop');

export class DropHandler {
  private readonly parserChoices = new Map<string, ParserPort>();

  constructor(
    private readonly app: App,
    private readonly pipeline: ConversionPipeline,
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
        const result = await this.pipeline.convertDroppedFile(data, parser);
        const frontmatter = createFrontmatter({ source: null, mtime: null, keep: true });
        const baseName = path.basename(file.name, ext);
        const outputName = `${baseName}.excalidraw.md`;
        const outputPath = dropFolder ? `${dropFolder}/${outputName}` : outputName;

        await this.saveToVault(outputPath, frontmatter + result);
        converted++;
        log.info(`Converted: ${file.name}`);
      } catch (error) {
        failed++;
        log.error(`Conversion failed: ${file.name}`, error);
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
    const result: File[] = [];
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const ext = path.extname(file.name).toLowerCase();
      const parsers = this.pipeline.getParsersForExtension(ext);
      if (parsers.length > 0) {
        result.push(file);
      }
    }
    return result;
  }

  private async resolveParser(
    fileName: string,
    ext: string,
  ): Promise<ParserPort | null> {
    const parsers = this.pipeline.getParsersForExtension(ext);
    if (parsers.length === 0) return null;
    if (parsers.length === 1) return parsers[0];

    const parserEntries = parsers.map((parser) => {
      for (const [id, p] of this.parserMap) {
        if (p === parser) return { id, parser };
      }
      return { id: 'unknown', parser };
    });

    const modal = new ParserSelectModal(this.app, fileName, ext, parserEntries);
    modal.open();
    const result: ParserSelectResult | null = await modal.waitForSelection();

    if (!result) return null;
    if (result.applyToAll) {
      this.parserChoices.set(ext, result.parser);
    }
    return result.parser;
  }

  private async saveToVault(outputPath: string, content: string): Promise<void> {
    const dir = path.dirname(outputPath);
    if (dir && dir !== '.' && !(await this.app.vault.adapter.exists(dir))) {
      await this.app.vault.createFolder(dir);
    }
    if (await this.app.vault.adapter.exists(outputPath)) {
      await this.app.vault.adapter.write(outputPath, content);
    } else {
      await this.app.vault.create(outputPath, content);
    }
  }
}
