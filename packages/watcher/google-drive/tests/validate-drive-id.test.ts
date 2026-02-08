import { describe, expect, it } from 'vitest';
import { validateDriveId } from '../src/validate-drive-id.js';

describe('validateDriveId', () => {
  it('유효한 folder ID를 허용한다', () => {
    expect(() => validateDriveId('1A2b3C4d5E6f7G8h9I0')).not.toThrow();
  });

  it('root를 허용한다', () => {
    expect(() => validateDriveId('root')).not.toThrow();
  });

  it('하이픈과 언더스코어를 포함한 ID를 허용한다', () => {
    expect(() => validateDriveId('abc-def_123')).not.toThrow();
  });

  it('작은따옴표가 포함된 ID를 거부한다', () => {
    expect(() => validateDriveId("id' OR 1=1")).toThrow();
  });

  it('공백이 포함된 ID를 거부한다', () => {
    expect(() => validateDriveId('id with spaces')).toThrow();
  });

  it('빈 문자열을 거부한다', () => {
    expect(() => validateDriveId('')).toThrow();
  });

  it('특수문자가 포함된 ID를 거부한다', () => {
    expect(() => validateDriveId('id;DROP TABLE')).toThrow();
  });
});
