import JSZip from 'jszip';
import { ColorExtractor } from './color-extractor.js';
import { InvalidFileFormatError, ParseError } from './exceptions.js';
import type { Note, Page, Stroke } from '@petrify/core';
import { DEFAULT_PAGE_HEIGHT, DEFAULT_PAGE_WIDTH, pointFromList, splitByTimestampGap } from '@petrify/core';

interface NoteFileInfo {
  fileName?: string;
  creationTime?: number;
  lastModifiedTime?: number;
}

interface PageResource {
  resourceType: number;
  id: string;
  fileName: string;
  nickname: string;
}

export class NoteParser {
  /** Viwoods PageResource 리소스 타입: mainBmp (배경 이미지) */
  static readonly RESOURCE_TYPE_MAINBMP = 1;
  /** Viwoods PageResource 리소스 타입: path (스트로크 경로) */
  static readonly RESOURCE_TYPE_PATH = 7;
  /**
   * 스트로크 구분 시간 임계값 (ms)
   * Viwoods 파일 분석 결과: 동일 스트로크 내 포인트 간격은 최대 5ms, 6ms 이상이면 별도 스트로크
   */
  static readonly DEFAULT_GAP_THRESHOLD = 6;
  private static readonly DEFAULT_COLOR = '#000000';
  /** 기본 알파값 (0-255), 완전 불투명 */
  private static readonly DEFAULT_ALPHA = 255;

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
      const content = await zip.file(infoFile)!.async('string');
      return JSON.parse(content) as NoteFileInfo;
    } catch (e) {
      throw new ParseError(`Failed to parse NoteFileInfo: ${e}`);
    }
  }

  private async parsePages(zip: JSZip): Promise<Page[]> {
    const fileNames = Object.keys(zip.files);
    const pathFiles = fileNames.filter(
      (name) => name.startsWith('path_') && name.endsWith('.json')
    );

    const pathToMainbmp = await this.parsePageResource(zip);
    const mainbmpFiles = fileNames.filter(
      (name) => name.startsWith('mainBmp_') && name.endsWith('.png')
    );

    const pages: Page[] = [];

    for (const pathFile of pathFiles) {
      const pageId = pathFile.replace('path_', '').replace('.json', '');
      const mainbmpData = await this.loadMainbmp(zip, pageId, pathToMainbmp, mainbmpFiles);
      const strokes = await this.parseStrokes(zip, pathFile, mainbmpData);

      pages.push({
        id: pageId,
        strokes,
        width: DEFAULT_PAGE_WIDTH,
        height: DEFAULT_PAGE_HEIGHT,
      });
    }

    return pages.length > 0
      ? pages
      : [{ id: 'empty', strokes: [], width: DEFAULT_PAGE_WIDTH, height: DEFAULT_PAGE_HEIGHT }];
  }

  private async parsePageResource(zip: JSZip): Promise<Record<string, string>> {
    const resourceFile = Object.keys(zip.files).find((name) => name.endsWith('_PageResource.json'));
    if (!resourceFile) return {};

    try {
      const content = await zip.file(resourceFile)!.async('string');
      const resources = JSON.parse(content) as PageResource[];

      const mainbmpById: Record<string, string> = {};
      const pathNicknames: string[] = [];

      for (const res of resources) {
        if (res.resourceType === NoteParser.RESOURCE_TYPE_MAINBMP) {
          mainbmpById[res.id] = res.fileName;
        } else if (res.resourceType === NoteParser.RESOURCE_TYPE_PATH) {
          pathNicknames.push(res.nickname);
        }
      }

      const result: Record<string, string> = {};
      for (const nickname of pathNicknames) {
        if (nickname in mainbmpById) {
          result[nickname] = mainbmpById[nickname];
        }
      }

      return result;
    } catch {
      // PageResource는 선택적 메타데이터 - 파싱 실패해도 mainBmp 자동 매핑 또는 기본 색상으로 진행 가능
      return {};
    }
  }

  private async loadMainbmp(
    zip: JSZip,
    pageId: string,
    pathToMainbmp: Record<string, string>,
    mainbmpFiles: string[]
  ): Promise<ArrayBuffer | null> {
    if (pageId in pathToMainbmp) {
      const file = zip.file(pathToMainbmp[pageId]);
      if (file) {
        return file.async('arraybuffer');
      }
    }

    if (mainbmpFiles.length === 1) {
      return zip.file(mainbmpFiles[0])!.async('arraybuffer');
    }

    return null;
  }

  private async parseStrokes(
    zip: JSZip,
    pathFile: string,
    mainbmpData: ArrayBuffer | null
  ): Promise<Stroke[]> {
    let data: number[][];
    try {
      const content = await zip.file(pathFile)!.async('string');
      data = JSON.parse(content);
    } catch (e) {
      throw new ParseError(`Failed to parse stroke data: ${e}`);
    }

    if (!data || data.length === 0) return [];

    if (!mainbmpData) {
      return splitByTimestampGap(data, NoteParser.DEFAULT_GAP_THRESHOLD);
    }

    const extractor = await ColorExtractor.fromPng(mainbmpData);
    return this.splitStrokesWithColor(data, extractor);
  }

  private splitStrokesWithColor(data: number[][], extractor: ColorExtractor): Stroke[] {
    if (data.length === 0) return [];

    const sortedData = [...data].sort((a, b) => a[2] - b[2]);
    const strokes: Stroke[] = [];
    let currentPoints: number[][] = [];
    let currentColor: string | null = null;
    let currentAlpha: number | null = null;

    for (let i = 0; i < sortedData.length; i++) {
      const pointData = sortedData[i];
      const x = Math.floor(pointData[0]);
      const y = Math.floor(pointData[1]);
      let { color, opacity: alpha } = extractor.getColorAt(x, y);

      const isBackground = ColorExtractor.BACKGROUND_COLORS.has(color.toLowerCase());

      if (isBackground) {
        color = currentColor ?? NoteParser.DEFAULT_COLOR;
        alpha = currentAlpha ?? NoteParser.DEFAULT_ALPHA;
      }

      if (i > 0) {
        const prevTs = sortedData[i - 1][2];
        const currTs = pointData[2];
        const gap = currTs - prevTs;

        const colorChanged = currentColor !== null && !isBackground && color !== currentColor;

        if (gap >= NoteParser.DEFAULT_GAP_THRESHOLD || colorChanged) {
          if (currentPoints.length > 0) {
            const width = extractor.extractStrokeWidth(currentPoints);
            strokes.push({
              points: currentPoints.map(pointFromList),
              color: currentColor ?? NoteParser.DEFAULT_COLOR,
              width,
              opacity: this.alphaToOpacity(currentAlpha),
            });
          }
          currentPoints = [];
        }
      }

      currentPoints.push(pointData);
      if (!isBackground || currentColor === null) {
        currentColor = color;
        currentAlpha = alpha;
      }
    }

    if (currentPoints.length > 0) {
      const width = extractor.extractStrokeWidth(currentPoints);
      strokes.push({
        points: currentPoints.map(pointFromList),
        color: currentColor ?? NoteParser.DEFAULT_COLOR,
        width,
        opacity: this.alphaToOpacity(currentAlpha),
      });
    }

    return strokes;
  }

  private alphaToOpacity(alpha: number | null): number {
    if (alpha === null) return 100;
    return Math.round((alpha / 255) * 100);
  }

  private timestampToDate(timestamp: number): Date {
    if (timestamp === 0) return new Date();
    return new Date(timestamp);
  }
}
