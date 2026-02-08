# Supernote X-series Parser Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Supernote X-series `.note` 파일을 파싱하여 페이지별 PNG 이미지를 추출하는 `@petrify/parser-supernote-x` 어댑터 패키지 구현

**Architecture:** 헥사고날 아키텍처의 ParserPort 구현체. 바이너리 파일을 읽어 주소 포인터 기반으로 푸터→헤더→페이지→레이어 순으로 파싱하고, RattaRLE/Flate 디코딩 후 레이어를 합성하여 PNG로 인코딩한다. SupernoteSharp(MIT) 로직 참고.

**Tech Stack:** TypeScript, pako (zlib), pngjs (PNG encoding)

**Working directory:** `/Users/minjun.jo/Projects/me/petrify/.worktrees/parser-supernote-x`

---

### Task 1: 패키지 스캐폴딩 + 루트 설정

**Files:**
- Create: `packages/parser/supernote-x/package.json`
- Create: `packages/parser/supernote-x/tsconfig.json`
- Create: `packages/parser/supernote-x/README.md`
- Create: `packages/parser/supernote-x/src/exceptions.ts`
- Create: `packages/parser/supernote-x/src/constants.ts`
- Create: `packages/parser/supernote-x/src/index.ts` (빈 export)
- Modify: `tsconfig.base.json` — paths에 `@petrify/parser-supernote-x` 추가
- Modify: `vitest.config.ts` — alias에 `@petrify/parser-supernote-x` 추가

**Step 1: 패키지 파일 생성**

`packages/parser/supernote-x/package.json`:
```json
{
  "name": "@petrify/parser-supernote-x",
  "version": "0.1.0",
  "type": "module",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "scripts": {
    "build": "tsup src/index.ts --format esm --dts",
    "test": "vitest run",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "@petrify/core": "workspace:*",
    "pako": "^2.1.0",
    "pngjs": "^7.0.0"
  }
}
```

`packages/parser/supernote-x/tsconfig.json`:
```json
{
  "extends": "../../../tsconfig.base.json",
  "compilerOptions": {
    "baseUrl": "../../..",
    "outDir": "dist"
  },
  "include": ["src"]
}
```

`packages/parser/supernote-x/README.md`:
```markdown
# @petrify/parser-supernote-x

Supernote X-series `.note` file parser — ParserPort implementation.

Supports: A5X, A6X, A6X2 (Nomad), A5X2 (Manta)

## Acknowledgments

This implementation references the parsing logic of:

- **[SupernoteSharp](https://github.com/nelinory/SupernoteSharp)** (MIT License) by nelinory
- **[supernote-tool](https://github.com/jya-dev/supernote-tool)** (Apache 2.0) by jya-dev
```

`packages/parser/supernote-x/src/exceptions.ts`:
```typescript
export { InvalidFileFormatError, ParseError } from '@petrify/core';
```

`packages/parser/supernote-x/src/constants.ts`:
```typescript
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
```

`packages/parser/supernote-x/src/index.ts`:
```typescript
export {};
```

**Step 2: 루트 설정 업데이트**

`tsconfig.base.json` — paths에 추가:
```json
"@petrify/parser-supernote-x": ["packages/parser/supernote-x/src/index.ts"]
```

`vitest.config.ts` — alias에 추가:
```typescript
'@petrify/parser-supernote-x': path.resolve(__dirname, 'packages/parser/supernote-x/src/index.ts'),
```

**Step 3: 의존성 설치**

Run: `pnpm install`

**Step 4: typecheck 확인**

Run: `pnpm typecheck`
Expected: PASS

**Step 5: 커밋**

```bash
git add packages/parser/supernote-x/ tsconfig.base.json vitest.config.ts pnpm-lock.yaml
git commit -m "feat(parser-supernote-x): 패키지 스캐폴딩 및 루트 설정"
```

---

### Task 2: BinaryReader

**Files:**
- Create: `packages/parser/supernote-x/src/binary-reader.ts`
- Create: `packages/parser/supernote-x/tests/binary-reader.test.ts`

**Step 1: 실패하는 테스트 작성**

`packages/parser/supernote-x/tests/binary-reader.test.ts`:
```typescript
import { describe, expect, it } from 'vitest';
import { BinaryReader } from '../src/binary-reader.js';

function makeBuffer(...bytes: number[]): ArrayBuffer {
  return new Uint8Array(bytes).buffer;
}

describe('BinaryReader', () => {
  describe('readUint32LE', () => {
    it('reads little-endian uint32', () => {
      const reader = new BinaryReader(makeBuffer(0x01, 0x00, 0x00, 0x00));
      expect(reader.readUint32LE()).toBe(1);
    });

    it('advances position by 4', () => {
      const reader = new BinaryReader(makeBuffer(0, 0, 0, 0, 1, 0, 0, 0));
      reader.readUint32LE();
      expect(reader.position).toBe(4);
      expect(reader.readUint32LE()).toBe(1);
    });
  });

  describe('readBytes', () => {
    it('returns correct slice', () => {
      const reader = new BinaryReader(makeBuffer(10, 20, 30, 40));
      expect(reader.readBytes(2)).toEqual(new Uint8Array([10, 20]));
      expect(reader.readBytes(2)).toEqual(new Uint8Array([30, 40]));
    });
  });

  describe('readString', () => {
    it('decodes UTF-8 string', () => {
      const bytes = new TextEncoder().encode('note');
      const reader = new BinaryReader(bytes.buffer);
      expect(reader.readString(4)).toBe('note');
    });
  });

  describe('seek', () => {
    it('sets read position', () => {
      const reader = new BinaryReader(makeBuffer(0, 0, 0, 0, 42, 0, 0, 0));
      reader.seek(4);
      expect(reader.readUint32LE()).toBe(42);
    });
  });

  describe('readBlock', () => {
    it('reads length-prefixed data block', () => {
      // block: [length=3 as uint32LE] [0xAA, 0xBB, 0xCC]
      const reader = new BinaryReader(makeBuffer(3, 0, 0, 0, 0xaa, 0xbb, 0xcc));
      expect(reader.readBlock()).toEqual(new Uint8Array([0xaa, 0xbb, 0xcc]));
    });

    it('returns empty for zero-length block', () => {
      const reader = new BinaryReader(makeBuffer(0, 0, 0, 0));
      expect(reader.readBlock()).toEqual(new Uint8Array(0));
    });
  });

  describe('readBlockAsString', () => {
    it('reads block and decodes as UTF-8', () => {
      const content = '<KEY:VALUE>';
      const contentBytes = new TextEncoder().encode(content);
      const buf = new Uint8Array(4 + contentBytes.length);
      new DataView(buf.buffer).setUint32(0, contentBytes.length, true);
      buf.set(contentBytes, 4);
      const reader = new BinaryReader(buf.buffer);
      expect(reader.readBlockAsString()).toBe('<KEY:VALUE>');
    });
  });

  describe('length', () => {
    it('returns buffer byte length', () => {
      const reader = new BinaryReader(makeBuffer(1, 2, 3));
      expect(reader.length).toBe(3);
    });
  });
});
```

**Step 2: 테스트 실패 확인**

Run: `pnpm --filter @petrify/parser-supernote-x test`
Expected: FAIL — `binary-reader.js` 모듈을 찾을 수 없음

**Step 3: 구현**

`packages/parser/supernote-x/src/binary-reader.ts`:
```typescript
export class BinaryReader {
  private readonly view: DataView;
  private readonly bytes: Uint8Array;
  private pos = 0;

  constructor(data: ArrayBuffer) {
    this.view = new DataView(data);
    this.bytes = new Uint8Array(data);
  }

  get position(): number {
    return this.pos;
  }

  get length(): number {
    return this.view.byteLength;
  }

  seek(offset: number): void {
    this.pos = offset;
  }

  readUint32LE(): number {
    const val = this.view.getUint32(this.pos, true);
    this.pos += 4;
    return val;
  }

  readBytes(length: number): Uint8Array {
    const slice = this.bytes.slice(this.pos, this.pos + length);
    this.pos += length;
    return slice;
  }

  readString(length: number): string {
    return new TextDecoder().decode(this.readBytes(length));
  }

  readBlock(): Uint8Array {
    const size = this.readUint32LE();
    if (size === 0) return new Uint8Array(0);
    return this.readBytes(size);
  }

  readBlockAsString(): string {
    return new TextDecoder().decode(this.readBlock());
  }
}
```

**Step 4: 테스트 통과 확인**

Run: `pnpm --filter @petrify/parser-supernote-x test`
Expected: PASS

**Step 5: 커밋**

```bash
git add packages/parser/supernote-x/src/binary-reader.ts packages/parser/supernote-x/tests/binary-reader.test.ts
git commit -m "feat(parser-supernote-x): BinaryReader 구현"
```

---

### Task 3: 메타데이터 파서

**Files:**
- Create: `packages/parser/supernote-x/src/metadata.ts`
- Create: `packages/parser/supernote-x/tests/metadata.test.ts`

**Step 1: 실패하는 테스트 작성**

`packages/parser/supernote-x/tests/metadata.test.ts`:
```typescript
import { describe, expect, it } from 'vitest';
import { getMetadataValue, getMetadataValues, parseMetadata } from '../src/metadata.js';

describe('parseMetadata', () => {
  it('parses single key-value pair', () => {
    const result = parseMetadata('<FILE_FEATURE:100>');
    expect(result).toEqual({ FILE_FEATURE: '100' });
  });

  it('parses multiple key-value pairs', () => {
    const result = parseMetadata('<PAGE0001:50><PAGE0002:200>');
    expect(result).toEqual({ PAGE0001: '50', PAGE0002: '200' });
  });

  it('handles duplicate keys as array', () => {
    const result = parseMetadata('<KEY:a><KEY:b><KEY:c>');
    expect(result).toEqual({ KEY: ['a', 'b', 'c'] });
  });

  it('handles empty value', () => {
    const result = parseMetadata('<KEY:>');
    expect(result).toEqual({ KEY: '' });
  });

  it('returns empty object for empty string', () => {
    expect(parseMetadata('')).toEqual({});
  });
});

describe('getMetadataValue', () => {
  it('returns string value', () => {
    const block = { KEY: 'value' };
    expect(getMetadataValue(block, 'KEY')).toBe('value');
  });

  it('returns first element of array value', () => {
    const block = { KEY: ['a', 'b'] };
    expect(getMetadataValue(block, 'KEY')).toBe('a');
  });

  it('returns undefined for missing key', () => {
    expect(getMetadataValue({}, 'KEY')).toBeUndefined();
  });
});

describe('getMetadataValues', () => {
  it('collects values matching key prefix', () => {
    const block = { PAGE0001: '10', PAGE0002: '20', FILE_FEATURE: '30' };
    expect(getMetadataValues(block, 'PAGE')).toEqual(['10', '20']);
  });

  it('flattens array values', () => {
    const block = { PAGE: ['10', '20'] };
    expect(getMetadataValues(block, 'PAGE')).toEqual(['10', '20']);
  });

  it('returns empty array when no match', () => {
    expect(getMetadataValues({}, 'PAGE')).toEqual([]);
  });
});
```

**Step 2: 테스트 실패 확인**

Run: `pnpm --filter @petrify/parser-supernote-x test`
Expected: FAIL

**Step 3: 구현**

`packages/parser/supernote-x/src/metadata.ts`:
```typescript
import { METADATA_REGEX } from './constants.js';

export interface MetadataBlock {
  [key: string]: string | string[];
}

export function parseMetadata(content: string): MetadataBlock {
  const result: MetadataBlock = {};
  const regex = new RegExp(METADATA_REGEX.source, METADATA_REGEX.flags);
  let match: RegExpExecArray | null;

  while ((match = regex.exec(content)) !== null) {
    const key = match[1];
    const value = match[2];
    const existing = result[key];

    if (existing === undefined) {
      result[key] = value;
    } else if (Array.isArray(existing)) {
      existing.push(value);
    } else {
      result[key] = [existing, value];
    }
  }

  return result;
}

export function getMetadataValue(block: MetadataBlock, key: string): string | undefined {
  const val = block[key];
  if (Array.isArray(val)) return val[0];
  return val;
}

export function getMetadataValues(block: MetadataBlock, keyPrefix: string): string[] {
  const values: string[] = [];
  for (const key of Object.keys(block)) {
    if (key.startsWith(keyPrefix)) {
      const val = block[key];
      if (Array.isArray(val)) {
        values.push(...val);
      } else if (val !== undefined) {
        values.push(val);
      }
    }
  }
  return values;
}
```

**Step 4: 테스트 통과 확인**

Run: `pnpm --filter @petrify/parser-supernote-x test`
Expected: PASS

**Step 5: 커밋**

```bash
git add packages/parser/supernote-x/src/metadata.ts packages/parser/supernote-x/tests/metadata.test.ts
git commit -m "feat(parser-supernote-x): 메타데이터 파서 구현"
```

---

### Task 4: RattaRLE 디코더

**Files:**
- Create: `packages/parser/supernote-x/src/decoder.ts`
- Create: `packages/parser/supernote-x/tests/decoder.test.ts`

**Step 1: 실패하는 테스트 작성**

`packages/parser/supernote-x/tests/decoder.test.ts`:
```typescript
import { describe, expect, it } from 'vitest';
import { decodeRattaRle } from '../src/decoder.js';

describe('decodeRattaRle', () => {
  it('decodes simple length+1 encoding', () => {
    // colorcode=0x61(BLACK→0x00), length=0x02 → 3 pixels
    // colorcode=0x62(BG→0xff), length=0x04 → 5 pixels
    const data = new Uint8Array([0x61, 0x02, 0x62, 0x04]);
    const result = decodeRattaRle(data, 8, 1, false);
    expect(Array.from(result)).toEqual([0x00, 0x00, 0x00, 0xff, 0xff, 0xff, 0xff, 0xff]);
  });

  it('decodes special length marker (0xFF) as 0x4000 pixels', () => {
    const data = new Uint8Array([0x62, 0xff]);
    const result = decodeRattaRle(data, 0x4000, 1, false);
    expect(result.length).toBe(0x4000);
    expect(result.every((v) => v === 0xff)).toBe(true);
  });

  it('decodes special length marker with allBlank as 0x400 pixels', () => {
    const data = new Uint8Array([0x62, 0xff]);
    const result = decodeRattaRle(data, 0x400, 1, false, true);
    expect(result.length).toBe(0x400);
    expect(result.every((v) => v === 0xff)).toBe(true);
  });

  it('decodes continuation bit (holder mechanism)', () => {
    // First pair: color=0x61, length=0x80 (continuation bit set)
    // Second pair: same color=0x61, length=0x05
    // Combined: 1 + 5 + (((0x80 & 0x7F) + 1) << 7) = 1 + 5 + 128 = 134
    const data = new Uint8Array([0x61, 0x80, 0x61, 0x05]);
    const result = decodeRattaRle(data, 134, 1, false);
    expect(result.length).toBe(134);
    expect(result.every((v) => v === 0x00)).toBe(true);
  });

  it('decodes continuation with different color (flush holder)', () => {
    // First pair: color=0x61, length=0x80 → holder
    // Second pair: color=0x62, length=0x02
    // Holder flush: 0x61 with length ((0x80 & 0x7F) + 1) << 7 = 128 pixels
    // Then: 0x62 with length 0x02 + 1 = 3 pixels
    const data = new Uint8Array([0x61, 0x80, 0x62, 0x02]);
    const result = decodeRattaRle(data, 131, 1, false);
    expect(result.slice(0, 128).every((v) => v === 0x00)).toBe(true);
    expect(result.slice(128, 131).every((v) => v === 0xff)).toBe(true);
  });

  it('maps X-series color codes correctly', () => {
    // 0x63→DARK_GRAY(0x9d), 0x64→GRAY(0xc9), 0x65→WHITE(0xfe)
    const data = new Uint8Array([0x63, 0x00, 0x64, 0x00, 0x65, 0x00]);
    const result = decodeRattaRle(data, 3, 1, false);
    expect(Array.from(result)).toEqual([0x9d, 0xc9, 0xfe]);
  });

  it('maps X2-series color codes correctly', () => {
    // X2: 0x9d→DARK_GRAY(0x9d), 0xc9→GRAY(0xc9)
    // X2 compat: 0x63→DARK_GRAY_COMPAT(0x30), 0x64→GRAY_COMPAT(0x50)
    const data = new Uint8Array([0x9d, 0x00, 0xc9, 0x00, 0x63, 0x00, 0x64, 0x00]);
    const result = decodeRattaRle(data, 4, 1, true);
    expect(Array.from(result)).toEqual([0x9d, 0xc9, 0x30, 0x50]);
  });

  it('fills remaining pixels with transparent on short data', () => {
    const data = new Uint8Array([0x61, 0x01]); // 2 BLACK pixels
    const result = decodeRattaRle(data, 5, 1, false);
    expect(Array.from(result)).toEqual([0x00, 0x00, 0xff, 0xff, 0xff]);
  });
});
```

**Step 2: 테스트 실패 확인**

Run: `pnpm --filter @petrify/parser-supernote-x test`
Expected: FAIL

**Step 3: 구현**

`packages/parser/supernote-x/src/decoder.ts`:
```typescript
import pako from 'pako';
import {
  INTERNAL_PAGE_HEIGHT,
  PALETTE_TRANSPARENT,
  RLE_CONTINUATION_BIT,
  RLE_SPECIAL_LENGTH,
  RLE_SPECIAL_LENGTH_BLANK,
  RLE_SPECIAL_LENGTH_MARKER,
  createColorMap,
} from './constants.js';

export function decodeRattaRle(
  data: Uint8Array,
  width: number,
  height: number,
  isX2: boolean,
  allBlank = false,
): Uint8Array {
  const colorMap = createColorMap(isX2);
  const totalPixels = width * height;
  const pixels = new Uint8Array(totalPixels);
  pixels.fill(PALETTE_TRANSPARENT);

  let pixelIdx = 0;
  let dataIdx = 0;
  let holderColor = -1;
  let holderLength = -1;

  const emit = (colorCode: number, count: number) => {
    const gray = colorMap.get(colorCode) ?? colorCode;
    const end = Math.min(pixelIdx + count, totalPixels);
    pixels.fill(gray, pixelIdx, end);
    pixelIdx = end;
  };

  while (dataIdx + 1 < data.length && pixelIdx < totalPixels) {
    const colorCode = data[dataIdx++];
    let length = data[dataIdx++];
    let dataPushed = false;

    if (holderColor >= 0) {
      const prevColor = holderColor;
      const prevLength = holderLength;
      holderColor = -1;
      holderLength = -1;

      if (colorCode === prevColor) {
        length = 1 + length + (((prevLength & 0x7f) + 1) << 7);
        emit(colorCode, length);
        dataPushed = true;
      } else {
        const adjustedLength = ((prevLength & 0x7f) + 1) << 7;
        emit(prevColor, adjustedLength);
      }
    }

    if (!dataPushed) {
      if (length === RLE_SPECIAL_LENGTH_MARKER) {
        length = allBlank ? RLE_SPECIAL_LENGTH_BLANK : RLE_SPECIAL_LENGTH;
        emit(colorCode, length);
      } else if ((length & RLE_CONTINUATION_BIT) !== 0) {
        holderColor = colorCode;
        holderLength = length;
      } else {
        length = length + 1;
        emit(colorCode, length);
      }
    }
  }

  if (holderColor >= 0 && pixelIdx < totalPixels) {
    emit(holderColor, totalPixels - pixelIdx);
  }

  return pixels;
}

export function decodeFlate(
  data: Uint8Array,
  width: number,
  height: number,
): Uint8Array {
  const decompressed = pako.inflate(data);
  const view = new DataView(decompressed.buffer, decompressed.byteOffset, decompressed.byteLength);

  const internalWidth = width;
  const rawPixels: number[] = [];
  for (let i = 0; i + 1 < decompressed.length; i += 2) {
    rawPixels.push(view.getUint16(i, true));
  }
  rawPixels.reverse();

  const pixels = new Uint8Array(width * height);
  pixels.fill(PALETTE_TRANSPARENT);

  let outIdx = 0;
  for (let i = 0; i < rawPixels.length && outIdx < width * height; i++) {
    if (i % internalWidth < INTERNAL_PAGE_HEIGHT) {
      const code = rawPixels[i];
      if (code === 0x0000) pixels[outIdx] = 0x00;
      else if (code === 0x2104) pixels[outIdx] = 0x9d;
      else if (code === 0xe1e2) pixels[outIdx] = 0xc9;
      else pixels[outIdx] = PALETTE_TRANSPARENT;
      outIdx++;
    }
  }

  return pixels;
}
```

**Step 4: 테스트 통과 확인**

Run: `pnpm --filter @petrify/parser-supernote-x test`
Expected: PASS

**Step 5: 커밋**

```bash
git add packages/parser/supernote-x/src/decoder.ts packages/parser/supernote-x/tests/decoder.test.ts
git commit -m "feat(parser-supernote-x): RattaRLE/Flate 디코더 구현"
```

---

### Task 5: 레이어 합성 + PNG 렌더러

**Files:**
- Create: `packages/parser/supernote-x/src/renderer.ts`
- Create: `packages/parser/supernote-x/tests/renderer.test.ts`

**Step 1: 실패하는 테스트 작성**

`packages/parser/supernote-x/tests/renderer.test.ts`:
```typescript
import { PNG } from 'pngjs';
import { describe, expect, it } from 'vitest';
import { PALETTE_TRANSPARENT } from '../src/constants.js';
import { compositeLayers, grayscaleToPng } from '../src/renderer.js';

describe('compositeLayers', () => {
  it('returns white canvas for no layers', () => {
    const result = compositeLayers([], 2, 2);
    expect(Array.from(result)).toEqual([0xff, 0xff, 0xff, 0xff]);
  });

  it('composites single layer over white background', () => {
    const layer = { pixels: new Uint8Array([0x00, 0xff, 0x9d, 0xff]), width: 2, height: 2 };
    const result = compositeLayers([layer], 2, 2);
    // 0xff(transparent) → stays white(0xff), non-transparent overwrites
    expect(Array.from(result)).toEqual([0x00, 0xff, 0x9d, 0xff]);
  });

  it('upper layer overwrites lower layer (non-transparent pixels)', () => {
    const bottom = { pixels: new Uint8Array([0x00, 0x00, 0x00, 0x00]), width: 2, height: 2 };
    const top = { pixels: new Uint8Array([0x9d, 0xff, 0xff, 0xc9]), width: 2, height: 2 };
    const result = compositeLayers([bottom, top], 2, 2);
    expect(Array.from(result)).toEqual([0x9d, 0x00, 0x00, 0xc9]);
  });
});

describe('grayscaleToPng', () => {
  it('produces valid PNG data', () => {
    const pixels = new Uint8Array([0x00, 0xff, 0x9d, 0xc9]);
    const pngData = grayscaleToPng(pixels, 2, 2);

    // Verify PNG magic bytes
    expect(pngData[0]).toBe(0x89);
    expect(pngData[1]).toBe(0x50); // 'P'
    expect(pngData[2]).toBe(0x4e); // 'N'
    expect(pngData[3]).toBe(0x47); // 'G'

    // Decode and verify pixel values
    const decoded = PNG.sync.read(Buffer.from(pngData));
    expect(decoded.width).toBe(2);
    expect(decoded.height).toBe(2);
    // First pixel: R=0x00, G=0x00, B=0x00, A=0xFF
    expect(decoded.data[0]).toBe(0x00);
    expect(decoded.data[3]).toBe(0xff);
  });
});
```

**Step 2: 테스트 실패 확인**

Run: `pnpm --filter @petrify/parser-supernote-x test`
Expected: FAIL

**Step 3: 구현**

`packages/parser/supernote-x/src/renderer.ts`:
```typescript
import { PNG } from 'pngjs';
import { PALETTE_TRANSPARENT } from './constants.js';

export interface LayerBitmap {
  readonly pixels: Uint8Array;
  readonly width: number;
  readonly height: number;
}

export function compositeLayers(
  layers: readonly LayerBitmap[],
  width: number,
  height: number,
): Uint8Array {
  const result = new Uint8Array(width * height);
  result.fill(PALETTE_TRANSPARENT);

  for (const layer of layers) {
    for (let i = 0; i < width * height; i++) {
      const pixel = layer.pixels[i];
      if (pixel !== PALETTE_TRANSPARENT) {
        result[i] = pixel;
      }
    }
  }

  return result;
}

export function grayscaleToPng(pixels: Uint8Array, width: number, height: number): Uint8Array {
  const png = new PNG({ width, height });

  for (let i = 0; i < width * height; i++) {
    const gray = pixels[i];
    png.data[i * 4] = gray;
    png.data[i * 4 + 1] = gray;
    png.data[i * 4 + 2] = gray;
    png.data[i * 4 + 3] = 255;
  }

  return new Uint8Array(PNG.sync.write(png));
}
```

**Step 4: 테스트 통과 확인**

Run: `pnpm --filter @petrify/parser-supernote-x test`
Expected: PASS

**Step 5: 커밋**

```bash
git add packages/parser/supernote-x/src/renderer.ts packages/parser/supernote-x/tests/renderer.test.ts
git commit -m "feat(parser-supernote-x): 레이어 합성 및 PNG 렌더러 구현"
```

---

### Task 6: NoteParser + SupernoteXParser

**Files:**
- Create: `packages/parser/supernote-x/src/parser.ts`
- Modify: `packages/parser/supernote-x/src/index.ts`
- Create: `packages/parser/supernote-x/tests/parser.test.ts`
- Create: `packages/parser/supernote-x/tests/test-helpers.ts`

**Step 1: 테스트 헬퍼 작성**

`packages/parser/supernote-x/tests/test-helpers.ts`:
```typescript
/**
 * 최소한의 유효한 Supernote X-series .note 바이너리를 생성하는 헬퍼.
 */

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
    const pageBlock = buildMetadataBlock({
      PAGEID: pageId,
      PAGESTYLE: 'style_white',
      MAINLAYER: String(layerOffset),
    });
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

  return concat(...parts).buffer;
}
```

**Step 2: 실패하는 테스트 작성**

`packages/parser/supernote-x/tests/parser.test.ts`:
```typescript
import { describe, expect, it } from 'vitest';
import { InvalidFileFormatError, ParseError } from '../src/exceptions.js';
import { NoteParser } from '../src/parser.js';
import { buildTestNote } from './test-helpers.js';

describe('NoteParser', () => {
  describe('signature validation', () => {
    it('rejects non-note file type', async () => {
      const data = new TextEncoder().encode('markSN_FILE_VER_20230015').buffer;
      const parser = new NoteParser();
      await expect(parser.parse(data)).rejects.toThrow(InvalidFileFormatError);
    });

    it('rejects invalid signature pattern', async () => {
      const data = new TextEncoder().encode('noteINVALID_SIGNATURE_X').buffer;
      const parser = new NoteParser();
      await expect(parser.parse(data)).rejects.toThrow(InvalidFileFormatError);
    });

    it('rejects buffer too small for signature', async () => {
      const parser = new NoteParser();
      await expect(parser.parse(new ArrayBuffer(10))).rejects.toThrow(InvalidFileFormatError);
    });
  });

  describe('page parsing', () => {
    it('parses single page note', async () => {
      const data = buildTestNote({ pages: [{ pageId: 'p1' }] });
      const parser = new NoteParser();
      const note = await parser.parse(data);

      expect(note.pages).toHaveLength(1);
      expect(note.pages[0].id).toBe('p1');
      expect(note.pages[0].order).toBe(0);
      expect(note.pages[0].imageData.length).toBeGreaterThan(0);
      // Verify PNG magic bytes
      expect(note.pages[0].imageData[0]).toBe(0x89);
      expect(note.pages[0].imageData[1]).toBe(0x50);
    });

    it('parses multi-page note', async () => {
      const data = buildTestNote({
        pages: [{ pageId: 'first' }, { pageId: 'second' }],
      });
      const parser = new NoteParser();
      const note = await parser.parse(data);

      expect(note.pages).toHaveLength(2);
      expect(note.pages[0].id).toBe('first');
      expect(note.pages[0].order).toBe(0);
      expect(note.pages[1].id).toBe('second');
      expect(note.pages[1].order).toBe(1);
    });
  });

  describe('footer parsing', () => {
    it('throws ParseError when footer address is out of bounds', async () => {
      const encoder = new TextEncoder();
      const prefix = encoder.encode('noteSN_FILE_VER_20230015');
      const buf = new Uint8Array(prefix.length + 4);
      buf.set(prefix, 0);
      // Footer address pointing beyond file
      new DataView(buf.buffer).setUint32(prefix.length, 0xffffffff, true);

      const parser = new NoteParser();
      await expect(parser.parse(buf.buffer)).rejects.toThrow(ParseError);
    });
  });
});
```

**Step 3: 테스트 실패 확인**

Run: `pnpm --filter @petrify/parser-supernote-x test`
Expected: FAIL

**Step 4: NoteParser 구현**

`packages/parser/supernote-x/src/parser.ts`:
```typescript
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
import { type LayerBitmap, compositeLayers, grayscaleToPng } from './renderer.js';

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
```

**Step 5: index.ts 업데이트**

`packages/parser/supernote-x/src/index.ts`:
```typescript
import type { Note, ParserPort } from '@petrify/core';
import { NoteParser } from './parser.js';

export class SupernoteXParser implements ParserPort {
  readonly extensions = ['.note'];

  private readonly parser = new NoteParser();

  async parse(data: ArrayBuffer): Promise<Note> {
    return this.parser.parse(data);
  }
}

export { InvalidFileFormatError, ParseError } from './exceptions.js';
export { NoteParser } from './parser.js';
```

**Step 6: 테스트 통과 확인**

Run: `pnpm --filter @petrify/parser-supernote-x test`
Expected: PASS

**Step 7: typecheck 확인**

Run: `pnpm typecheck`
Expected: PASS

**Step 8: 커밋**

```bash
git add packages/parser/supernote-x/src/ packages/parser/supernote-x/tests/
git commit -m "feat(parser-supernote-x): NoteParser 및 SupernoteXParser 구현"
```

---

### Task 7: Obsidian 플러그인 통합

**Files:**
- Modify: `packages/obsidian-plugin/src/parser-registry.ts`
- Modify: `packages/obsidian-plugin/package.json`

**Step 1: parser-registry.ts 수정**

`packages/obsidian-plugin/src/parser-registry.ts`에 추가:

```typescript
import { SupernoteXParser } from '@petrify/parser-supernote-x';
```

`ParserId` enum에 추가:
```typescript
SupernoteX = 'supernote-x',
```

`createParserMap()`에 추가:
```typescript
[ParserId.SupernoteX, new SupernoteXParser()],
```

**Step 2: package.json 의존성 추가**

`packages/obsidian-plugin/package.json`의 dependencies에 추가:
```json
"@petrify/parser-supernote-x": "workspace:*"
```

**Step 3: 의존성 설치 + 빌드 확인**

Run: `pnpm install && pnpm --filter @petrify/obsidian-plugin build`
Expected: 성공

**Step 4: 전체 테스트**

Run: `pnpm test`
Expected: PASS

**Step 5: 커밋**

```bash
git add packages/obsidian-plugin/src/parser-registry.ts packages/obsidian-plugin/package.json pnpm-lock.yaml
git commit -m "feat(obsidian-plugin): SupernoteXParser 등록"
```

---

### Task 8: 최종 검증 + 문서 업데이트

**Step 1: 포맷팅**

Run: `pnpm biome check --write`

**Step 2: 최종 검증**

Run: `pnpm typecheck && pnpm test && pnpm biome check`
Expected: 모두 PASS

**Step 3: `/align-architecture` 스킬로 아키텍처 문서 동기화**

`/align-architecture` 스킬을 실행하여 AGENTS.md의 패키지 구조/테이블, 코드 컨벤션 등을 코드베이스와 동기화한다.

**Step 4: 커밋**

문서 변경사항을 커밋한다.

**Step 5: `/align-readme` 스킬로 README 동기화**

`/align-readme` 스킬을 실행하여 README.md, CONTRIBUTING.md를 코드베이스와 동기화한다.

---

## 참고: Supernote .note 바이너리 포맷

### 파일 구조
```
[0-3]   파일 타입 ("note")
[4-23]  시그니처 ("SN_FILE_VER_XXXXXXXX")
[...]   데이터 블록들 (메타데이터, 비트맵 등)
[-4]    푸터 주소 (uint32 LE)
```

### 데이터 블록
```
[4바이트 길이 (uint32 LE)] [내용 바이트]
```

### 메타데이터 블록
데이터 블록의 내용이 `<KEY:VALUE>` 형식의 텍스트:
```
<FILE_FEATURE:100><PAGE0001:200><PAGE0002:300>
```

### RattaRLE 디코딩
- `(colorCode, length)` 바이트 쌍의 스트림
- `length + 1` = 기본 픽셀 수
- `length == 0xFF` → 특수 길이 (0x4000 또는 0x400)
- `length & 0x80` → 연속 비트 (다음 쌍과 결합)

### 레이어 합성
BGLAYER → MAINLAYER → LAYER1 → LAYER2 → LAYER3 순서로 합성. 0xff(transparent) 픽셀은 건너뜀.
