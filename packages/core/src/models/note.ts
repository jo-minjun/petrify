import type { Page } from './page.js';

export interface Note {
  readonly title: string;
  readonly pages: Page[];
  readonly createdAt: Date;
  readonly modifiedAt: Date;
}
