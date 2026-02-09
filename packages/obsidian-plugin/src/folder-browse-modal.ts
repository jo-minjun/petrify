import type { GoogleDriveClient } from '@petrify/watcher-google-drive';
import type { App } from 'obsidian';
import { Modal } from 'obsidian';

export interface FolderBrowseResult {
  folderId: string;
  folderName: string;
}

export class FolderBrowseModal extends Modal {
  private readonly client: GoogleDriveClient;
  private readonly onSelect: (result: FolderBrowseResult) => void;
  private breadcrumb: { id: string | undefined; name: string }[] = [];
  private currentFolderId: string | undefined = undefined;

  constructor(app: App, client: GoogleDriveClient, onSelect: (result: FolderBrowseResult) => void) {
    super(app);
    this.client = client;
    this.onSelect = onSelect;
  }

  onOpen(): void {
    this.breadcrumb = [{ id: undefined, name: 'My Drive' }];
    this.currentFolderId = undefined;
    void this.renderFolderList();
  }

  onClose(): void {
    this.contentEl.empty();
  }

  private async renderFolderList(): Promise<void> {
    const { contentEl } = this;
    contentEl.empty();

    contentEl.createEl('h2', { text: 'Select Google Drive folder' });

    const breadcrumbContainer = contentEl.createDiv({ cls: 'petrify-breadcrumb' });

    for (let i = 0; i < this.breadcrumb.length; i++) {
      const crumb = this.breadcrumb[i];
      const isLast = i === this.breadcrumb.length - 1;

      if (i > 0) {
        breadcrumbContainer.createSpan({ text: ' / ' });
      }

      if (isLast) {
        breadcrumbContainer.createEl('strong', { text: crumb.name });
      } else {
        const link = breadcrumbContainer.createEl('a', { text: crumb.name, href: '#' });
        link.addEventListener('click', (e) => {
          e.preventDefault();
          this.breadcrumb = this.breadcrumb.slice(0, i + 1);
          this.currentFolderId = crumb.id;
          void this.renderFolderList();
        });
      }
    }

    if (this.currentFolderId !== undefined) {
      const selectCurrentBtn = contentEl.createEl('button', {
        text: 'Select current folder',
        cls: 'mod-cta petrify-select-current-btn',
      });
      selectCurrentBtn.addEventListener('click', () => {
        const current = this.breadcrumb[this.breadcrumb.length - 1];
        if (current.id !== undefined) {
          this.onSelect({ folderId: current.id, folderName: current.name });
          this.close();
        }
      });
    }

    const loadingEl = contentEl.createEl('p', { text: 'Loading...' });

    try {
      const folders = await this.client.listFolders(this.currentFolderId);
      loadingEl.remove();

      if (folders.length === 0) {
        contentEl.createEl('p', { text: 'No folders found' });
        return;
      }

      const listContainer = contentEl.createDiv({ cls: 'petrify-folder-browse' });

      for (const folder of folders) {
        const itemDiv = listContainer.createDiv({ cls: 'petrify-folder-item' });

        const nameEl = itemDiv.createEl('a', {
          text: `\u{1F4C1} ${folder.name}`,
          href: '#',
        });
        nameEl.addEventListener('click', (e) => {
          e.preventDefault();
          this.breadcrumb.push({ id: folder.id, name: folder.name });
          this.currentFolderId = folder.id;
          void this.renderFolderList();
        });

        const selectBtn = itemDiv.createEl('button', { text: 'Select' });
        selectBtn.addEventListener('click', () => {
          this.onSelect({ folderId: folder.id, folderName: folder.name });
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
