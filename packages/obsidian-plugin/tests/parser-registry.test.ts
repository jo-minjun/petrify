import { describe, it, expect, beforeEach } from 'vitest';
import type { ParserPort, Note } from '@petrify/core';
import { ParserRegistry } from '../src/parser-registry.js';

class MockParser implements ParserPort {
  readonly extensions = ['.note', '.viwoods'];
  async parse(_data: ArrayBuffer): Promise<Note> {
    return { title: 'mock', pages: [], createdAt: new Date(), modifiedAt: new Date() };
  }
}

class AnotherMockParser implements ParserPort {
  readonly extensions = ['.rm'];
  async parse(_data: ArrayBuffer): Promise<Note> {
    return { title: 'another', pages: [], createdAt: new Date(), modifiedAt: new Date() };
  }
}

describe('ParserRegistry', () => {
  let registry: ParserRegistry;

  beforeEach(() => {
    registry = new ParserRegistry();
  });

  it('파서를 등록하고 확장자로 찾을 수 있다', () => {
    const parser = new MockParser();
    registry.register(parser);

    expect(registry.getParserForExtension('.note')).toBe(parser);
    expect(registry.getParserForExtension('.viwoods')).toBe(parser);
  });

  it('지원하지 않는 확장자는 undefined를 반환한다', () => {
    const parser = new MockParser();
    registry.register(parser);

    expect(registry.getParserForExtension('.unknown')).toBeUndefined();
  });

  it('여러 파서를 등록할 수 있다', () => {
    const parser1 = new MockParser();
    const parser2 = new AnotherMockParser();
    registry.register(parser1);
    registry.register(parser2);

    expect(registry.getParserForExtension('.note')).toBe(parser1);
    expect(registry.getParserForExtension('.rm')).toBe(parser2);
  });

  it('지원하는 모든 확장자를 반환한다', () => {
    const parser1 = new MockParser();
    const parser2 = new AnotherMockParser();
    registry.register(parser1);
    registry.register(parser2);

    const extensions = registry.getSupportedExtensions();
    expect(extensions).toContain('.note');
    expect(extensions).toContain('.viwoods');
    expect(extensions).toContain('.rm');
  });
});
