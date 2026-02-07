import { readdir } from 'node:fs/promises';
import { homedir } from 'node:os';
import { basename, dirname, join, sep } from 'node:path';
import type { App } from 'obsidian';
import { Modal } from 'obsidian';

export class LocalFolderBrowseModal extends Modal {
  private readonly onSelect: (path: string) => void;
  private currentPath: string;
  private breadcrumb: string[] = [];

  constructor(app: App, onSelect: (path: string) => void, initialPath?: string) {
    super(app);
    this.onSelect = onSelect;
    this.currentPath = initialPath && initialPath.trim() !== '' ? initialPath : homedir();
  }

  async onOpen(): Promise<void> {
    this.breadcrumb = this.buildBreadcrumb(this.currentPath);
    await this.renderFolderList();
  }

  onClose(): void {
    this.contentEl.empty();
  }

  private buildBreadcrumb(path: string): string[] {
    const parts: string[] = [];
    let current = path;
    while (true) {
      parts.unshift(current);
      const parent = dirname(current);
      if (parent === current) break;
      current = parent;
    }
    return parts;
  }

  private async renderFolderList(): Promise<void> {
    const { contentEl } = this;
    contentEl.empty();

    contentEl.createEl('h2', { text: 'Select Folder' });

    const breadcrumbContainer = contentEl.createDiv({ cls: 'petrify-breadcrumb' });
    breadcrumbContainer.style.marginBottom = '12px';
    breadcrumbContainer.style.wordBreak = 'break-all';

    for (let i = 0; i < this.breadcrumb.length; i++) {
      const segment = this.breadcrumb[i];
      const isLast = i === this.breadcrumb.length - 1;
      const displayName = basename(segment) || segment;

      if (i > 0) {
        breadcrumbContainer.createSpan({ text: ` ${sep} ` });
      }

      if (isLast) {
        const bold = breadcrumbContainer.createEl('strong', { text: displayName });
        bold.style.cursor = 'default';
      } else {
        const link = breadcrumbContainer.createEl('a', { text: displayName, href: '#' });
        link.style.cursor = 'pointer';
        link.addEventListener('click', (e: Event) => {
          e.preventDefault();
          this.currentPath = segment;
          this.breadcrumb = this.breadcrumb.slice(0, i + 1);
          this.renderFolderList();
        });
      }
    }

    const selectCurrentBtn = contentEl.createEl('button', {
      text: 'Select current folder',
      cls: 'mod-cta',
    });
    selectCurrentBtn.style.marginTop = '8px';
    selectCurrentBtn.style.marginBottom = '8px';
    selectCurrentBtn.style.display = 'block';
    selectCurrentBtn.addEventListener('click', () => {
      this.onSelect(this.currentPath);
      this.close();
    });

    const loadingEl = contentEl.createEl('p', { text: 'Loading...' });

    try {
      const entries = await readdir(this.currentPath, { withFileTypes: true });
      loadingEl.remove();

      const folders = entries
        .filter((e) => e.isDirectory() && !e.name.startsWith('.'))
        .sort((a, b) => a.name.localeCompare(b.name));

      if (folders.length === 0) {
        contentEl.createEl('p', { text: 'No folders found' });
        return;
      }

      const listContainer = contentEl.createDiv({ cls: 'petrify-folder-browse' });
      listContainer.style.maxHeight = '300px';
      listContainer.style.overflowY = 'auto';

      for (const folder of folders) {
        const fullPath = join(this.currentPath, folder.name);
        const itemDiv = listContainer.createDiv({ cls: 'petrify-folder-item' });
        itemDiv.style.display = 'flex';
        itemDiv.style.alignItems = 'center';
        itemDiv.style.justifyContent = 'space-between';
        itemDiv.style.padding = '4px 0';

        const nameEl = itemDiv.createEl('a', {
          text: `\u{1F4C1} ${folder.name}`,
          href: '#',
        });
        nameEl.style.cursor = 'pointer';
        nameEl.style.flexGrow = '1';
        nameEl.addEventListener('click', (e: Event) => {
          e.preventDefault();
          this.currentPath = fullPath;
          this.breadcrumb.push(fullPath);
          this.renderFolderList();
        });

        const selectBtn = itemDiv.createEl('button', { text: 'Select' });
        selectBtn.style.marginLeft = '8px';
        selectBtn.style.flexShrink = '0';
        selectBtn.addEventListener('click', () => {
          this.onSelect(fullPath);
          this.close();
        });
      }
    } catch (err) {
      loadingEl.remove();
      const message = err instanceof Error ? err.message : String(err);
      console.error('Failed to list folders:', err);
      contentEl.createEl('p', { text: `Error: ${message}` });
    }
  }
}
