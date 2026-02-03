import { describe, it, expect } from 'vitest';
import { Page } from '../../src/models/page';

describe('Page', () => {
  it('Page 생성', () => {
    const page: Page = {
      id: 'page-1',
      strokes: [],
      width: 1440,
      height: 1920,
    };
    expect(page.id).toBe('page-1');
    expect(page.width).toBe(1440);
    expect(page.height).toBe(1920);
  });
});
