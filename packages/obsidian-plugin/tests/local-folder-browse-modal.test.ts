import { beforeEach, describe, expect, it, vi } from 'vitest';

interface MockElement {
  tag?: string;
  text: string;
  cls?: string;
  href?: string;
  style: Record<string, string>;
  children: MockElement[];
  listeners: Map<string, ((...args: unknown[]) => void)[]>;
  createEl(tag: string, opts?: { text?: string; cls?: string; href?: string }): MockElement;
  createDiv(opts?: { cls?: string }): MockElement;
  createSpan(opts?: { text?: string }): MockElement;
  empty(): void;
  remove(): void;
  addEventListener(event: string, handler: (...args: unknown[]) => void): void;
  querySelector(selector: string): MockElement | null;
  textContent: string;
  click(): void;
}

function createMockElement(tag?: string, text?: string): MockElement {
  const el: MockElement = {
    tag,
    text: text ?? '',
    style: {},
    children: [],
    listeners: new Map(),
    createEl(t: string, opts?: { text?: string; cls?: string; href?: string }) {
      const child = createMockElement(t, opts?.text);
      child.cls = opts?.cls;
      child.href = opts?.href;
      el.children.push(child);
      return child;
    },
    createDiv(opts?: { cls?: string }) {
      return el.createEl('div', { cls: opts?.cls });
    },
    createSpan(opts?: { text?: string }) {
      return el.createEl('span', { text: opts?.text });
    },
    empty() {
      el.children = [];
      el.text = '';
    },
    remove() {},
    addEventListener(event: string, handler: (...args: unknown[]) => void) {
      if (!el.listeners.has(event)) {
        el.listeners.set(event, []);
      }
      el.listeners.get(event)?.push(handler);
    },
    querySelector(selector: string): MockElement | null {
      for (const child of el.children) {
        if (selector === 'button:not(.mod-cta)') {
          if (child.tag === 'button' && child.cls !== 'mod-cta') return child;
        }
        const found = child.querySelector(selector);
        if (found) return found;
      }
      return null;
    },
    get textContent(): string {
      const own = el.text;
      const childTexts = el.children.map((c) => c.textContent).join('');
      return own + childTexts;
    },
    click() {
      const handlers = el.listeners.get('click') ?? [];
      for (const h of handlers) h({ preventDefault: () => {} });
    },
  };
  return el;
}

vi.mock('obsidian', () => ({
  Modal: class {
    app: unknown;
    contentEl: MockElement;
    constructor(app: unknown) {
      this.app = app;
      this.contentEl = createMockElement('div');
    }
    open() {}
    close() {}
  },
}));

const mockReaddir = vi.fn();
vi.mock('node:fs/promises', () => ({
  readdir: (...args: unknown[]) => mockReaddir(...args),
}));

vi.mock('node:os', () => ({
  homedir: () => '/Users/test',
}));

import { LocalFolderBrowseModal } from '../src/local-folder-browse-modal.js';

function createModal(
  onSelect = vi.fn(),
  initialPath?: string,
): { modal: InstanceType<typeof LocalFolderBrowseModal>; onSelect: ReturnType<typeof vi.fn> } {
  const app = {};
  return { modal: new LocalFolderBrowseModal(app as never, onSelect, initialPath), onSelect };
}

describe('LocalFolderBrowseModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('홈 디렉터리에서 하위 폴더 목록을 렌더링한다', async () => {
    mockReaddir.mockResolvedValue([
      { name: 'Documents', isDirectory: () => true },
      { name: 'file.txt', isDirectory: () => false },
      { name: 'Downloads', isDirectory: () => true },
    ]);

    const { modal } = createModal();
    await modal.onOpen();

    const text = modal.contentEl.textContent ?? '';
    expect(text).toContain('Documents');
    expect(text).toContain('Downloads');
    expect(text).not.toContain('file.txt');
  });

  it('폴더 Select 버튼 클릭 시 onSelect 콜백이 호출된다', async () => {
    mockReaddir.mockResolvedValue([{ name: 'Documents', isDirectory: () => true }]);

    const { modal, onSelect } = createModal();
    await modal.onOpen();

    const selectBtn = modal.contentEl.querySelector(
      'button:not(.mod-cta)',
    ) as HTMLButtonElement | null;
    selectBtn?.click();

    expect(onSelect).toHaveBeenCalledWith(expect.stringContaining('Documents'));
  });

  it('빈 디렉터리에서 "No folders found" 메시지를 표시한다', async () => {
    mockReaddir.mockResolvedValue([]);

    const { modal } = createModal();
    await modal.onOpen();

    expect(modal.contentEl.textContent).toContain('No folders found');
  });

  it('initialPath가 유효하면 해당 경로에서 시작한다', async () => {
    mockReaddir.mockResolvedValue([{ name: 'sub', isDirectory: () => true }]);

    const { modal } = createModal(vi.fn(), '/Users/test/Documents');
    await modal.onOpen();

    expect(mockReaddir).toHaveBeenCalledWith('/Users/test/Documents', { withFileTypes: true });
  });

  it('readdir 실패 시 에러 메시지를 표시한다', async () => {
    mockReaddir.mockRejectedValue(new Error('EACCES: permission denied'));

    const { modal } = createModal();
    await modal.onOpen();

    expect(modal.contentEl.textContent).toContain('permission denied');
  });
});
