import type { App } from 'obsidian';
import { Modal, Notice, Setting } from 'obsidian';

export class AuthCodeModal extends Modal {
  private input = '';
  private readonly onSubmit: (code: string) => void;

  constructor(app: App, onSubmit: (code: string) => void) {
    super(app);
    this.onSubmit = onSubmit;
  }

  onOpen(): void {
    const { contentEl } = this;

    contentEl.createEl('h3', { text: 'Google Drive authentication' });
    contentEl.createEl('p', {
      text: 'Sign in with google in the browser. After approval, the page will redirect to localhost — this is expected.',
    });
    contentEl.createEl('p', {
      text: 'Copy the entire URL from the browser address bar and paste it below.',
    });

    new Setting(contentEl).setName('Authorization code').addText((text) =>
      text.setPlaceholder('Paste URL or code here').onChange((value) => {
        this.input = value;
      }),
    );

    new Setting(contentEl).addButton((btn) =>
      btn
        .setButtonText('Submit')
        .setCta()
        .onClick(() => {
          const code = this.extractCode(this.input.trim());
          if (code) {
            this.onSubmit(code);
            this.close();
          } else {
            new Notice('Could not extract authorization code from the input');
          }
        }),
    );
  }

  onClose(): void {
    this.contentEl.empty();
  }

  private extractCode(input: string): string | null {
    if (!input) return null;
    try {
      const url = new URL(input);
      return url.searchParams.get('code');
    } catch {
      return input;
    }
  }
}
