import type { Note, Page } from '@petrify/core';
import { BinaryReader } from './binary-reader.js';
import {
  BLANK_CONTENT_LENGTH,
  FOOTER_ADDRESS_SIZE,
  LAYER_KEYS,
  PAGE_HEIGHT,
  PAGE_WIDTH,
  PROTOCOL_FLATE,
  SN_FILE_TYPE_LENGTH,
  SN_FILE_TYPE_NOTE,
  SN_SIGNATURE_LENGTH,
  SN_SIGNATURE_PATTERN,
  STYLE_WHITE,
  X2_FIRMWARE_THRESHOLD,
  X2_PAGE_HEIGHT,
  X2_PAGE_WIDTH,
} from './constants.js';
import { decodeFlate, decodeRattaRle } from './decoder.js';
import { InvalidFileFormatError, ParseError } from './exceptions.js';
import { getMetadataValue, getMetadataValues, parseMetadata } from './metadata.js';
import { compositeLayers, grayscaleToPng, type LayerBitmap } from './renderer.js';

interface SignatureInfo {
  readonly isX2: boolean;
}

interface LayerVisibility {
  readonly isBackgroundLayer: boolean;
  readonly layerId: number;
  readonly isVisible: boolean;
}

function parseLayerVisibility(raw: string): Map<string, boolean> {
  const visibility = new Map<string, boolean>();
  try {
    const json = raw.replace(/#/g, ':');
    const layers = JSON.parse(json) as LayerVisibility[];
    for (const layer of layers) {
      const name = layer.isBackgroundLayer
        ? 'BGLAYER'
        : layer.layerId === 0
          ? 'MAINLAYER'
          : `LAYER${layer.layerId}`;
      visibility.set(name, layer.isVisible);
    }
  } catch {
    visibility.set('MAINLAYER', true);
  }
  return visibility;
}

export class NoteParser {
  async parse(data: ArrayBuffer): Promise<Note> {
    const reader = new BinaryReader(data);

    const minSize = SN_FILE_TYPE_LENGTH + SN_SIGNATURE_LENGTH + FOOTER_ADDRESS_SIZE;
    if (reader.length < minSize) {
      throw new InvalidFileFormatError('File too small to be a valid Supernote note');
    }

    const { isX2 } = this.validateSignature(reader);

    reader.seek(reader.length - FOOTER_ADDRESS_SIZE);
    const footerAddress = reader.readUint32LE();
    if (footerAddress >= reader.length - FOOTER_ADDRESS_SIZE) {
      throw new ParseError('Footer address out of bounds');
    }

    reader.seek(footerAddress);
    const footer = parseMetadata(reader.readBlockAsString());

    const headerAddress = getMetadataValue(footer, 'FILE_FEATURE');
    let pageWidth = PAGE_WIDTH;
    let pageHeight = PAGE_HEIGHT;

    if (headerAddress) {
      reader.seek(Number(headerAddress));
      const header = parseMetadata(reader.readBlockAsString());
      if (getMetadataValue(header, 'APPLY_EQUIPMENT') === 'N5') {
        pageWidth = X2_PAGE_WIDTH;
        pageHeight = X2_PAGE_HEIGHT;
      }
    }

    const pageAddresses = getMetadataValues(footer, 'PAGE');
    if (pageAddresses.length === 0) {
      throw new ParseError('No pages found');
    }

    const pages: Page[] = [];
    for (let i = 0; i < pageAddresses.length; i++) {
      const page = this.parsePage(reader, Number(pageAddresses[i]), i, pageWidth, pageHeight, isX2);
      if (page) pages.push(page);
    }

    return {
      title: 'Untitled',
      pages,
      createdAt: new Date(0),
      modifiedAt: new Date(0),
    };
  }

  private validateSignature(reader: BinaryReader): SignatureInfo {
    const fileType = reader.readString(SN_FILE_TYPE_LENGTH);
    if (fileType !== SN_FILE_TYPE_NOTE) {
      throw new InvalidFileFormatError(`Unsupported file type: ${fileType}`);
    }

    const signature = reader.readString(SN_SIGNATURE_LENGTH);
    if (!SN_SIGNATURE_PATTERN.test(signature)) {
      throw new InvalidFileFormatError(`Invalid signature: ${signature}`);
    }

    const firmwareVersion = Number.parseInt(signature.slice(-8), 10);
    return { isX2: firmwareVersion >= X2_FIRMWARE_THRESHOLD };
  }

  private parsePage(
    reader: BinaryReader,
    address: number,
    order: number,
    pageWidth: number,
    pageHeight: number,
    isX2: boolean,
  ): Page | null {
    reader.seek(address);
    const pageMeta = parseMetadata(reader.readBlockAsString());

    const pageId = getMetadataValue(pageMeta, 'PAGEID') ?? `page-${order}`;
    const pageStyle = getMetadataValue(pageMeta, 'PAGESTYLE') ?? '';
    const orientation = getMetadataValue(pageMeta, 'ORIENTATION') ?? '1000';

    let width = pageWidth;
    let height = pageHeight;
    if (orientation === '1090') {
      width = pageHeight;
      height = pageWidth;
    }

    const layerInfoRaw = getMetadataValue(pageMeta, 'LAYERINFO');
    const visibility = layerInfoRaw
      ? parseLayerVisibility(layerInfoRaw)
      : new Map([['MAINLAYER', true]]);

    const layerSeqRaw = getMetadataValue(pageMeta, 'LAYERSEQ');
    const layerOrder = layerSeqRaw ? layerSeqRaw.split(',').reverse() : [...LAYER_KEYS].reverse();

    const layerBitmaps: LayerBitmap[] = [];

    for (const layerName of layerOrder) {
      if (visibility.has(layerName) && !visibility.get(layerName)) continue;

      const layerAddress = getMetadataValue(pageMeta, layerName);
      if (!layerAddress) continue;

      try {
        reader.seek(Number(layerAddress));
        const layerMeta = parseMetadata(reader.readBlockAsString());
        const protocol = getMetadataValue(layerMeta, 'LAYERPROTOCOL') ?? '';
        const bitmapAddress = getMetadataValue(layerMeta, 'LAYERBITMAP');
        if (!bitmapAddress) continue;

        reader.seek(Number(bitmapAddress));
        const bitmapData = reader.readBlock();
        if (bitmapData.length === 0) continue;

        const isBlank =
          layerName === 'BGLAYER' &&
          pageStyle === STYLE_WHITE &&
          bitmapData.length === BLANK_CONTENT_LENGTH;

        const pixels =
          protocol === PROTOCOL_FLATE
            ? decodeFlate(bitmapData, width, height)
            : decodeRattaRle(bitmapData, width, height, isX2, isBlank);

        layerBitmaps.push({ pixels, width, height });
      } catch (e) {
        console.warn(`[Petrify:Parser] Failed to decode layer ${layerName}: ${e}`);
      }
    }

    if (layerBitmaps.length === 0) {
      console.warn(`[Petrify:Parser] No decodable layers for page ${pageId}`);
      return null;
    }

    const composited = compositeLayers(layerBitmaps, width, height);
    const imageData = grayscaleToPng(composited, width, height);

    return { id: pageId, imageData, order, width, height };
  }
}
