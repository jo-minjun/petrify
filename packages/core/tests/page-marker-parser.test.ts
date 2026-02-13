import { describe, expect, it } from 'vitest';
import { parsePageMarkers } from '../src/ocr/page-marker-parser.js';

describe('parsePageMarkers', () => {
  it('parses page markers with text', () => {
    const lines = ['<!-- page: p1 -->', 'Hello world', '<!-- page: p2 -->', 'Second page'];

    const result = parsePageMarkers(lines);

    expect(result.get('p1')).toEqual(['Hello world']);
    expect(result.get('p2')).toEqual(['Second page']);
  });

  it('handles multi-line text per page', () => {
    const lines = ['<!-- page: p1 -->', 'Line one', 'Line two', 'Line three'];

    const result = parsePageMarkers(lines);

    expect(result.get('p1')).toEqual(['Line one', 'Line two', 'Line three']);
  });

  it('filters out empty lines', () => {
    const lines = ['<!-- page: p1 -->', 'Text', '', '', '<!-- page: p2 -->', 'More'];

    const result = parsePageMarkers(lines);

    expect(result.get('p1')).toEqual(['Text']);
    expect(result.get('p2')).toEqual(['More']);
  });

  it('skips lines before any marker', () => {
    const lines = ['Some random text', '<!-- page: p1 -->', 'Actual text'];

    const result = parsePageMarkers(lines);

    expect(result.size).toBe(1);
    expect(result.get('p1')).toEqual(['Actual text']);
  });

  it('returns empty map when no markers', () => {
    const lines = ['No markers here', 'Just text'];

    const result = parsePageMarkers(lines);

    expect(result.size).toBe(0);
  });

  it('skips pages with only empty lines', () => {
    const lines = ['<!-- page: p1 -->', '', '', '<!-- page: p2 -->', 'Has text'];

    const result = parsePageMarkers(lines);

    expect(result.has('p1')).toBe(false);
    expect(result.get('p2')).toEqual(['Has text']);
  });
});
