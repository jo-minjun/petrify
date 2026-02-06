import JSZip from 'jszip';
import { InvalidFileFormatError, ParseError } from './exceptions.js';
import type { Note, Page } from '@petrify/core';
import { DEFAULT_PAGE_HEIGHT, DEFAULT_PAGE_WIDTH } from '@petrify/core';

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
      createdAt: this.timestampToDate(noteInfo.creationTime ?? 0),
      modifiedAt: this.timestampToDate(noteInfo.lastModifiedTime ?? 0),
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
      throw new ParseError(`Failed to parse NoteFileInfo: ${e}`);
    }
  }

  private async parsePageList(zip: JSZip): Promise<PageListEntry[]> {
    const pageListFile = Object.keys(zip.files).find((name) =>
      name.endsWith('_PageListFileInfo.json')
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
      throw new ParseError(`Failed to parse PageListFileInfo: ${e}`);
    }
  }

  private async parsePages(zip: JSZip): Promise<Page[]> {
    const pageList = await this.parsePageList(zip);
    const pages: Page[] = [];

    for (const entry of pageList) {
      const screenshotFile = `screenshotBmp_${entry.id}.png`;
      const file = zip.file(screenshotFile);

      if (!file) {
        throw new ParseError(`Screenshot not found for page ${entry.id}: ${screenshotFile}`);
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

  private timestampToDate(timestamp: number): Date {
    if (timestamp === 0) return new Date(0);
    return new Date(timestamp);
  }
}
