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

  async onOpen(): Promise<void> {
    this.breadcrumb = [{ id: undefined, name: 'My Drive' }];
    this.currentFolderId = undefined;
    await this.renderFolderList();
  }

  onClose(): void {
    this.contentEl.empty();
  }

  private async renderFolderList(): Promise<void> {
    const { contentEl } = this;
    contentEl.empty();

    contentEl.createEl('h2', { text: 'Select Google Drive Folder' });

    const breadcrumbContainer = contentEl.createDiv({ cls: 'petrify-breadcrumb' });
    breadcrumbContainer.style.marginBottom = '12px';

    for (let i = 0; i < this.breadcrumb.length; i++) {
      const crumb = this.breadcrumb[i];
      const isLast = i === this.breadcrumb.length - 1;

      if (i > 0) {
        breadcrumbContainer.createSpan({ text: ' / ' });
      }

      if (isLast) {
        const bold = breadcrumbContainer.createEl('strong', { text: crumb.name });
        bold.style.cursor = 'default';
      } else {
        const link = breadcrumbContainer.createEl('a', { text: crumb.name, href: '#' });
        link.style.cursor = 'pointer';
        link.addEventListener('click', (e) => {
          e.preventDefault();
          this.breadcrumb = this.breadcrumb.slice(0, i + 1);
          this.currentFolderId = crumb.id;
          this.renderFolderList();
        });
      }
    }

    if (this.currentFolderId !== undefined) {
      const selectCurrentBtn = contentEl.createEl('button', {
        text: 'Select current folder',
        cls: 'mod-cta',
      });
      selectCurrentBtn.style.marginTop = '8px';
      selectCurrentBtn.style.marginBottom = '8px';
      selectCurrentBtn.style.display = 'block';
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
        nameEl.addEventListener('click', (e) => {
          e.preventDefault();
          this.breadcrumb.push({ id: folder.id, name: folder.name });
          this.currentFolderId = folder.id;
          this.renderFolderList();
        });

        const selectBtn = itemDiv.createEl('button', { text: 'Select' });
        selectBtn.style.marginLeft = '8px';
        selectBtn.style.flexShrink = '0';
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
