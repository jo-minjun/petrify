import type { Note, Page, ParserPort } from '@petrify/core';
import { InvalidFileFormatError, ParseError } from '@petrify/core';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';

interface PdfInfo {
  readonly Title?: string;
  readonly CreationDate?: string;
  readonly ModDate?: string;
}

interface PdfMetadata {
  readonly info?: PdfInfo;
}

interface PdfViewport {
  readonly width: number;
  readonly height: number;
}

interface PdfRenderTask {
  readonly promise: Promise<void>;
}

interface PdfPage {
  getViewport(params: { scale: number }): PdfViewport;
  render(params: { canvasContext: unknown; viewport: PdfViewport }): PdfRenderTask;
}

interface PdfDocument {
  readonly numPages: number;
  getPage(pageNumber: number): Promise<PdfPage>;
  getMetadata(): Promise<PdfMetadata>;
  cleanup?(): void;
  destroy?(): Promise<void>;
}

interface PdfLoadingTask {
  readonly promise: Promise<PdfDocument>;
  destroy?(): void;
}

interface RenderCanvas {
  getContext(): unknown | null;
  toPngBytes(): Promise<Uint8Array>;
}

type LoadPdfFn = (data: Uint8Array) => PdfLoadingTask;
type CreateCanvasFn = (width: number, height: number) => RenderCanvas;

interface NoteMetadata {
  readonly title: string;
  readonly createdAt: Date;
  readonly modifiedAt: Date;
}

const DEFAULT_DATE = new Date(0);
const DEFAULT_TITLE = 'Untitled';
const DEFAULT_SCALE = 2;
const MAX_PAGE_COUNT = 5000;
const MAX_PAGE_WIDTH = 10_000;
const MAX_PAGE_HEIGHT = 10_000;
const MAX_PAGE_PIXELS = 50_000_000;

export class PdfParser implements ParserPort {
  readonly extensions = ['.pdf'];

  constructor(
    private readonly loadPdf: LoadPdfFn = loadPdfDocument,
    private readonly createCanvas: CreateCanvasFn = createDefaultCanvas,
    private readonly scale: number = DEFAULT_SCALE,
  ) {}

  async parse(data: ArrayBuffer): Promise<Note> {
    const document = await this.loadDocument(data);

    try {
      const metadata = await this.readMetadata(document);
      const pages = await this.readPages(document);

      return {
        title: metadata.title,
        pages,
        createdAt: metadata.createdAt,
        modifiedAt: metadata.modifiedAt,
      };
    } finally {
      await this.cleanupDocument(document);
    }
  }

  private async loadDocument(data: ArrayBuffer): Promise<PdfDocument> {
    let task: PdfLoadingTask;
    try {
      task = this.loadPdf(new Uint8Array(data));
    } catch (error) {
      throw new InvalidFileFormatError(`Failed to open PDF: ${toErrorMessage(error)}`);
    }

    try {
      return await task.promise;
    } catch (error) {
      task.destroy?.();
      throw new InvalidFileFormatError(`Failed to open PDF: ${toErrorMessage(error)}`);
    }
  }

  private async readMetadata(document: PdfDocument): Promise<NoteMetadata> {
    const defaults: NoteMetadata = {
      title: DEFAULT_TITLE,
      createdAt: DEFAULT_DATE,
      modifiedAt: DEFAULT_DATE,
    };

    try {
      const metadata = await document.getMetadata();
      const info = metadata.info;
      const title = normalizeTitle(info?.Title);

      return {
        title,
        createdAt: parsePdfDate(info?.CreationDate) ?? DEFAULT_DATE,
        modifiedAt: parsePdfDate(info?.ModDate) ?? DEFAULT_DATE,
      };
    } catch (error) {
      console.debug(`[Petrify:Parser] Failed to parse PDF metadata: ${toErrorMessage(error)}`);
      return defaults;
    }
  }

  private async readPages(document: PdfDocument): Promise<Page[]> {
    if (document.numPages <= 0) {
      throw new ParseError('PDF contains no pages');
    }
    if (document.numPages > MAX_PAGE_COUNT) {
      throw new ParseError(`PDF contains too many pages (${document.numPages})`);
    }

    const pages: Page[] = [];

    for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber++) {
      pages.push(await this.renderPage(document, pageNumber));
    }

    return pages;
  }

  private async renderPage(document: PdfDocument, pageNumber: number): Promise<Page> {
    let page: PdfPage;
    try {
      page = await document.getPage(pageNumber);
    } catch (error) {
      throw new ParseError(`Failed to load page ${pageNumber}: ${toErrorMessage(error)}`);
    }

    const viewport = page.getViewport({ scale: this.scale });
    const width = normalizeDimension(viewport.width);
    const height = normalizeDimension(viewport.height);
    const pixels = width * height;

    if (width > MAX_PAGE_WIDTH || height > MAX_PAGE_HEIGHT || pixels > MAX_PAGE_PIXELS) {
      throw new ParseError(
        `Page ${pageNumber} dimensions are too large (${width}x${height}, ${pixels} pixels)`,
      );
    }

    const canvas = this.createCanvas(width, height);
    const context = canvas.getContext();
    if (!context) {
      throw new ParseError(`Failed to create canvas context for page ${pageNumber}`);
    }

    try {
      await page.render({ canvasContext: context, viewport }).promise;
    } catch (error) {
      throw new ParseError(`Failed to render page ${pageNumber}: ${toErrorMessage(error)}`);
    }

    let imageData: Uint8Array;
    try {
      imageData = await canvas.toPngBytes();
    } catch (error) {
      throw new ParseError(`Failed to encode page ${pageNumber}: ${toErrorMessage(error)}`);
    }

    if (imageData.length === 0) {
      throw new ParseError(`Rendered page ${pageNumber} is empty`);
    }

    return {
      id: `page-${pageNumber}`,
      imageData,
      order: pageNumber - 1,
      width,
      height,
    };
  }

  private async cleanupDocument(document: PdfDocument): Promise<void> {
    try {
      document.cleanup?.();
    } catch {
      // Ignore cleanup errors
    }

    try {
      await document.destroy?.();
    } catch {
      // Ignore destroy errors
    }
  }
}

function loadPdfDocument(data: Uint8Array): PdfLoadingTask {
  return getDocument({
    data,
    useWorkerFetch: false,
    isEvalSupported: false,
  }) as PdfLoadingTask;
}

function createDefaultCanvas(width: number, height: number): RenderCanvas {
  if (typeof document !== 'undefined') {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;

    return {
      getContext: () => canvas.getContext('2d'),
      toPngBytes: () => canvasToPngBytes(canvas),
    };
  }

  if (typeof OffscreenCanvas !== 'undefined') {
    const canvas = new OffscreenCanvas(width, height);

    return {
      getContext: () => canvas.getContext('2d'),
      toPngBytes: async () => {
        const blob = await canvas.convertToBlob({ type: 'image/png' });
        return new Uint8Array(await blob.arrayBuffer());
      },
    };
  }

  throw new ParseError('Canvas API is unavailable in this environment');
}

function canvasToPngBytes(canvas: HTMLCanvasElement): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new ParseError('Failed to convert canvas to blob'));
          return;
        }
        blob
          .arrayBuffer()
          .then((buffer) => resolve(new Uint8Array(buffer)))
          .catch((error) =>
            reject(new ParseError(`Failed to read canvas blob: ${toErrorMessage(error)}`)),
          );
      },
      'image/png',
      1,
    );
  });
}

function normalizeTitle(value?: string): string {
  if (!value) return DEFAULT_TITLE;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : DEFAULT_TITLE;
}

function normalizeDimension(value: number): number {
  if (!Number.isFinite(value)) return 1;
  const rounded = Math.round(value);
  return rounded > 0 ? rounded : 1;
}

function parsePdfDate(rawValue?: string): Date | null {
  if (!rawValue) return null;

  const normalized = rawValue.startsWith('D:') ? rawValue.slice(2) : rawValue;
  if (!/^\d{4}/.test(normalized)) return null;

  const year = readNumber(normalized, 0, 4, 0, 9999);
  if (year === null) return null;

  const month = readNumber(normalized, 4, 2, 1, 12) ?? 1;
  const day = readNumber(normalized, 6, 2, 1, 31) ?? 1;
  const hour = readNumber(normalized, 8, 2, 0, 23) ?? 0;
  const minute = readNumber(normalized, 10, 2, 0, 59) ?? 0;
  const second = readNumber(normalized, 12, 2, 0, 59) ?? 0;

  const utcMillis = Date.UTC(year, month - 1, day, hour, minute, second);
  const timezone = normalized.slice(14).replaceAll("'", '');

  if (timezone.length === 0 || timezone.startsWith('Z')) {
    return new Date(utcMillis);
  }

  const sign = timezone[0];
  if (sign !== '+' && sign !== '-') {
    return new Date(utcMillis);
  }

  const offsetHours = readNumber(timezone, 1, 2, 0, 23) ?? 0;
  const offsetMinutes = readNumber(timezone, 3, 2, 0, 59) ?? 0;
  const offset = (offsetHours * 60 + offsetMinutes) * 60 * 1000;

  return new Date(sign === '+' ? utcMillis - offset : utcMillis + offset);
}

function readNumber(
  value: string,
  start: number,
  length: number,
  min: number,
  max: number,
): number | null {
  const part = value.slice(start, start + length);
  if (part.length === 0) return null;
  if (!/^\d+$/.test(part)) return null;

  const parsed = Number.parseInt(part, 10);
  if (Number.isNaN(parsed) || parsed < min || parsed > max) {
    return null;
  }

  return parsed;
}

function toErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
