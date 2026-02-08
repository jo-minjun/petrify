import { METADATA_REGEX } from './constants.js';

export interface MetadataBlock {
  [key: string]: string | string[];
}

export function parseMetadata(content: string): MetadataBlock {
  const result: MetadataBlock = {};
  const regex = new RegExp(METADATA_REGEX.source, METADATA_REGEX.flags);
  let match = regex.exec(content);

  while (match !== null) {
    const key = match[1];
    const value = match[2];
    const existing = result[key];

    if (existing === undefined) {
      result[key] = value;
    } else if (Array.isArray(existing)) {
      existing.push(value);
    } else {
      result[key] = [existing, value];
    }

    match = regex.exec(content);
  }

  return result;
}

export function getMetadataValue(block: MetadataBlock, key: string): string | undefined {
  const val = block[key];
  if (Array.isArray(val)) return val[0];
  return val;
}

export function getMetadataValues(block: MetadataBlock, keyPrefix: string): string[] {
  const values: string[] = [];
  for (const key of Object.keys(block)) {
    if (key.startsWith(keyPrefix)) {
      const val = block[key];
      if (Array.isArray(val)) {
        values.push(...val);
      } else if (val !== undefined) {
        values.push(val);
      }
    }
  }
  return values;
}
