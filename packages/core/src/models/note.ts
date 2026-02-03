// packages/core/src/models/note.ts
import type { Page } from './page';

export interface Note {
  title: string;
  pages: Page[];
  createdAt: Date;
  modifiedAt: Date;
}
