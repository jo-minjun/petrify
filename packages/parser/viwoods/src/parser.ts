import type { Note, Page } from '@petrify/core';
import { DEFAULT_PAGE_HEIGHT, DEFAULT_PAGE_WIDTH } from '@petrify/core';
import JSZip from 'jszip';
import { InvalidFileFormatError, ParseError } from './exceptions.js';

interface NoteFileInfo {
  fileName?: string;
  creationTime?: number;
  lastModifiedTime?: number;
}

interface PageListEntry {
  id: string;
  order: number;
}

export class NoteParser {
  async parse(data: ArrayBuffer): Promise<Note> {
    let zip: JSZip;
    try {
      zip = await JSZip.loadAsync(data);
    } catch {
      throw new InvalidFileFormatError('Not a valid zip file');
    }

    return this.parseContents(zip);
  }

  private async parseContents(zip: JSZip): Promise<Note> {
    const noteInfo = await this.parseNoteInfo(zip);
    const pages = await this.parsePages(zip);

    return {
      title: noteInfo.fileName ?? 'Untitled',
      pages,
      createdAt: new Date(noteInfo.creationTime ?? 0),
      modifiedAt: new Date(noteInfo.lastModifiedTime ?? 0),
    };
  }

  private async parseNoteInfo(zip: JSZip): Promise<NoteFileInfo> {
    const infoFile = Object.keys(zip.files).find((name) => name.endsWith('_NoteFileInfo.json'));
    if (!infoFile) return {};

    try {
      const file = zip.file(infoFile);
      if (!file) throw new ParseError(`File not found in archive: ${infoFile}`);
      const content = await file.async('string');
      return JSON.parse(content) as NoteFileInfo;
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      throw new ParseError(`Failed to parse NoteFileInfo: ${message}`);
    }
  }

  private async parsePageList(zip: JSZip): Promise<PageListEntry[]> {
    const pageListFile = Object.keys(zip.files).find((name) =>
      name.endsWith('_PageListFileInfo.json'),
    );
    if (!pageListFile) {
      throw new ParseError('PageListFileInfo.json not found');
    }

    try {
      const file = zip.file(pageListFile);
      if (!file) throw new ParseError(`File not found in archive: ${pageListFile}`);
      const content = await file.async('string');
      const entries = JSON.parse(content) as PageListEntry[];
      return entries.sort((a, b) => a.order - b.order);
    } catch (e) {
      if (e instanceof ParseError) throw e;
      const message = e instanceof Error ? e.message : String(e);
      throw new ParseError(`Failed to parse PageListFileInfo: ${message}`);
    }
  }

  private async parsePages(zip: JSZip): Promise<Page[]> {
    const pageList = await this.parsePageList(zip);
    const pages: Page[] = [];

    for (const entry of pageList) {
      const screenshotFile = `screenshotBmp_${entry.id}.png`;
      const file = zip.file(screenshotFile);

      if (!file) {
        console.debug(
          `[Petrify:Parser] Screenshot not found, skipping page ${entry.id}: ${screenshotFile}`,
        );
        continue;
      }

      const imageData = await file.async('uint8array');

      pages.push({
        id: entry.id,
        imageData,
        order: entry.order,
        width: DEFAULT_PAGE_WIDTH,
        height: DEFAULT_PAGE_HEIGHT,
      });
    }

    return pages;
  }
}
