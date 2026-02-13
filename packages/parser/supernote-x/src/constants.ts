export const SN_SIGNATURE_PATTERN = /^SN_FILE_VER_\d{8}$/;
export const SN_SIGNATURE_LENGTH = 20;
export const SN_FILE_TYPE_LENGTH = 4;
export const SN_FILE_TYPE_NOTE = 'note';
export const FOOTER_ADDRESS_SIZE = 4;

export const X2_FIRMWARE_THRESHOLD = 20230015;

export const PAGE_WIDTH = 1404;
export const PAGE_HEIGHT = 1872;
export const X2_PAGE_WIDTH = 1920;
export const X2_PAGE_HEIGHT = 2560;
export const INTERNAL_PAGE_HEIGHT = 1888;

export const RLE_SPECIAL_LENGTH_MARKER = 0xff;
export const RLE_SPECIAL_LENGTH = 0x4000;
export const RLE_SPECIAL_LENGTH_BLANK = 0x400;
export const RLE_CONTINUATION_BIT = 0x80;

export const BLANK_CONTENT_LENGTH = 0x140e;
export const STYLE_WHITE = 'style_white';
export const PROTOCOL_FLATE = 'SN_ASA_COMPRESS';
export const PROTOCOL_RLE = 'RATTA_RLE';
export const MAX_FLATE_DECOMPRESSED_BYTES = 20 * 1024 * 1024;

export const LAYER_KEYS = ['MAINLAYER', 'LAYER1', 'LAYER2', 'LAYER3', 'BGLAYER'] as const;
export const METADATA_REGEX = /<([^:<>]+):([^:<>]*)>/g;

export const PALETTE_TRANSPARENT = 0xff;

export function createColorMap(isX2: boolean): Map<number, number> {
  const map = new Map<number, number>();
  map.set(0x61, 0x00);
  map.set(0x62, 0xff);
  map.set(0x65, 0xfe);
  map.set(0x66, 0x00);

  if (isX2) {
    map.set(0x9d, 0x9d);
    map.set(0xc9, 0xc9);
    map.set(0x9e, 0x9d);
    map.set(0xca, 0xc9);
    map.set(0x63, 0x30);
    map.set(0x64, 0x50);
  } else {
    map.set(0x63, 0x9d);
    map.set(0x64, 0xc9);
    map.set(0x67, 0x9d);
    map.set(0x68, 0xc9);
  }

  return map;
}
