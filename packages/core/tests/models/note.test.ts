import { describe, it, expect } from 'vitest';
import { Note } from '../../src/models/note';

describe('Note', () => {
  it('Note 생성', () => {
    const note: Note = {
      title: 'Test Note',
      pages: [],
      createdAt: new Date(),
      modifiedAt: new Date(),
    };
    expect(note.title).toBe('Test Note');
    expect(note.pages).toHaveLength(0);
  });
});
