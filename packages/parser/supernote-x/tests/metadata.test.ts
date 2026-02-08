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
