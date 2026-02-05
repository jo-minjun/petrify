import { describe, it, expect } from 'vitest';
import type { Page } from '../../src/models/page';

describe('Page', () => {
  it('Page 생성', () => {
    const page: Page = {
      id: 'page-1',
      imageData: new Uint8Array([0x89, 0x50, 0x4e, 0x47]),
      order: 0,
      width: 1440,
      height: 1920,
    };
    expect(page.id).toBe('page-1');
    expect(page.width).toBe(1440);
    expect(page.height).toBe(1920);
  });

  it('imageData가 Uint8Array 타입이다', () => {
    const page: Page = {
      id: 'page-1',
      imageData: new Uint8Array([1, 2, 3]),
      order: 0,
      width: 1440,
      height: 1920,
    };
    expect(page.imageData).toBeInstanceOf(Uint8Array);
    expect(page.imageData.length).toBe(3);
  });

  it('order로 페이지 순서를 나타낸다', () => {
    const page: Page = {
      id: 'page-2',
      imageData: new Uint8Array(),
      order: 1,
      width: 1440,
      height: 1920,
    };
    expect(page.order).toBe(1);
  });
});
