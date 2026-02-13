function buildMetadataBlock(entries: Record<string, string>): Uint8Array {
  const content = Object.entries(entries)
    .map(([k, v]) => `<${k}:${v}>`)
    .join('');
  const contentBytes = new TextEncoder().encode(content);
  const block = new Uint8Array(4 + contentBytes.length);
  new DataView(block.buffer).setUint32(0, contentBytes.length, true);
  block.set(contentBytes, 4);
  return block;
}

function buildDataBlock(data: Uint8Array): Uint8Array {
  const block = new Uint8Array(4 + data.length);
  new DataView(block.buffer).setUint32(0, data.length, true);
  block.set(data, 4);
  return block;
}

function concat(...arrays: Uint8Array[]): Uint8Array {
  const total = arrays.reduce((sum, a) => sum + a.length, 0);
  const result = new Uint8Array(total);
  let pos = 0;
  for (const arr of arrays) {
    result.set(arr, pos);
    pos += arr.length;
  }
  return result;
}

export interface TestPageOptions {
  pageId?: string;
  rleData?: Uint8Array;
  layerInfo?: string;
}

export function buildTestNote(options?: { pages?: TestPageOptions[] }): ArrayBuffer {
  const pages = options?.pages ?? [{}];
  const encoder = new TextEncoder();

  // 1. File type + signature (24 bytes)
  const prefix = encoder.encode('noteSN_FILE_VER_20230015');

  // Build from inside out, tracking offsets
  const parts: Uint8Array[] = [prefix];
  let offset = prefix.length;

  // 2. Per-page: bitmap → layer → page metadata
  const pageOffsets: number[] = [];

  for (let i = 0; i < pages.length; i++) {
    const page = pages[i];
    const pageId = page.pageId ?? `page-${i}`;
    const layerInfo = page.layerInfo;
    // All-transparent bitmap: fills width*height with 0xff
    const rleData = page.rleData ?? new Uint8Array([0x62, 0xff]);

    const bitmapOffset = offset;
    const bitmapBlock = buildDataBlock(rleData);
    parts.push(bitmapBlock);
    offset += bitmapBlock.length;

    const layerOffset = offset;
    const layerBlock = buildMetadataBlock({
      LAYERNAME: 'MAINLAYER',
      LAYERPROTOCOL: 'RATTA_RLE',
      LAYERBITMAP: String(bitmapOffset),
    });
    parts.push(layerBlock);
    offset += layerBlock.length;

    const pageOffset = offset;
    pageOffsets.push(pageOffset);
    const pageEntries: Record<string, string> = {
      PAGEID: pageId,
      PAGESTYLE: 'style_white',
      MAINLAYER: String(layerOffset),
    };
    if (layerInfo !== undefined) {
      pageEntries.LAYERINFO = layerInfo;
    }
    const pageBlock = buildMetadataBlock(pageEntries);
    parts.push(pageBlock);
    offset += pageBlock.length;
  }

  // 3. Header metadata
  const headerOffset = offset;
  const headerBlock = buildMetadataBlock({
    APPLY_EQUIPMENT: 'SN100',
  });
  parts.push(headerBlock);
  offset += headerBlock.length;

  // 4. Footer metadata
  const footerOffset = offset;
  const footerEntries: Record<string, string> = {
    FILE_FEATURE: String(headerOffset),
  };
  for (let i = 0; i < pageOffsets.length; i++) {
    footerEntries[`PAGE${String(i + 1).padStart(4, '0')}`] = String(pageOffsets[i]);
  }
  const footerBlock = buildMetadataBlock(footerEntries);
  parts.push(footerBlock);
  offset += footerBlock.length;

  // 5. Footer address (last 4 bytes)
  const footerAddr = new Uint8Array(4);
  new DataView(footerAddr.buffer).setUint32(0, footerOffset, true);
  parts.push(footerAddr);

  return concat(...parts).buffer as ArrayBuffer;
}
