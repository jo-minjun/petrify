import { describe, expect, it } from 'vitest';
import { validateDriveId } from '../src/validate-drive-id.js';

describe('validateDriveId', () => {
  it('accepts a valid folder ID', () => {
    expect(() => validateDriveId('1A2b3C4d5E6f7G8h9I0')).not.toThrow();
  });

  it('accepts root', () => {
    expect(() => validateDriveId('root')).not.toThrow();
  });

  it('accepts an ID containing hyphens and underscores', () => {
    expect(() => validateDriveId('abc-def_123')).not.toThrow();
  });

  it('rejects an ID containing single quotes', () => {
    expect(() => validateDriveId("id' OR 1=1")).toThrow();
  });

  it('rejects an ID containing spaces', () => {
    expect(() => validateDriveId('id with spaces')).toThrow();
  });

  it('rejects an empty string', () => {
    expect(() => validateDriveId('')).toThrow();
  });

  it('rejects an ID containing special characters', () => {
    expect(() => validateDriveId('id;DROP TABLE')).toThrow();
  });
});
