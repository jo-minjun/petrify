import { ConversionError } from '@petrify/core';
import { describe, expect, it } from 'vitest';
import { formatConversionError } from '../src/format-conversion-error.js';

describe('formatConversionError', () => {
  it('ConversionError(parse) → "Parse failed: {fileName}"', () => {
    const error = new ConversionError('parse', new Error('invalid'));
    expect(formatConversionError('test.note', error)).toBe('Parse failed: test.note');
  });

  it('ConversionError(ocr) → "OCR failed: {fileName}"', () => {
    const error = new ConversionError('ocr', new Error('timeout'));
    expect(formatConversionError('test.note', error)).toBe('OCR failed: test.note');
  });

  it('ConversionError(generate) → "Generate failed: {fileName}"', () => {
    const error = new ConversionError('generate', new Error('template'));
    expect(formatConversionError('test.note', error)).toBe('Generate failed: test.note');
  });

  it('ConversionError(save) → "Save failed: {fileName}"', () => {
    const error = new ConversionError('save', new Error('ENOSPC'));
    expect(formatConversionError('test.note', error)).toBe('Save failed: test.note');
  });

  it('일반 Error → "Conversion failed: {fileName}"', () => {
    const error = new Error('unexpected');
    expect(formatConversionError('test.note', error)).toBe('Conversion failed: test.note');
  });

  it('문자열 에러 → "Conversion failed: {fileName}"', () => {
    expect(formatConversionError('test.note', 'string error')).toBe('Conversion failed: test.note');
  });
});
