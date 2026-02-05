import { App, Modal, Setting } from 'obsidian';
import type { ParserPort } from '@petrify/core';

export interface ParserSelectResult {
  parser: ParserPort;
  applyToAll: boolean;
}

export class ParserSelectModal extends Modal {
  private selectedParser: ParserPort;
  private applyToAll = false;
  private resolve: ((result: ParserSelectResult | null) => void) | null = null;

  constructor(
    app: App,
    private readonly fileName: string,
    private readonly extension: string,
    private readonly parsers: Array<{ id: string; parser: ParserPort }>,
  ) {
    super(app);
    this.selectedParser = parsers[0].parser;
  }

  onOpen(): void {
    const { contentEl } = this;
    contentEl.empty();

    contentEl.createEl('h2', { text: 'Select Parser' });
    contentEl.createEl('p', {
      text: `Choose a parser for "${this.fileName}":`,
    });

    const radioGroup = contentEl.createDiv();
    for (const { id, parser } of this.parsers) {
      const label = radioGroup.createEl('label', { cls: 'petrify-parser-option' });
      const radio = label.createEl('input', {
        type: 'radio',
        attr: { name: 'parser', value: id },
      });
      if (parser === this.selectedParser) {
        radio.checked = true;
      }
      label.appendText(` ${id}`);
      radio.addEventListener('change', () => {
        this.selectedParser = parser;
      });
      radioGroup.createEl('br');
    }

    new Setting(contentEl)
      .setName(`Apply to all ${this.extension} files`)
      .addToggle((toggle) =>
        toggle.setValue(false).onChange((value) => {
          this.applyToAll = value;
        })
      );

    new Setting(contentEl)
      .addButton((btn) =>
        btn.setButtonText('Convert').setCta().onClick(() => {
          this.resolve?.({ parser: this.selectedParser, applyToAll: this.applyToAll });
          this.close();
        })
      )
      .addButton((btn) =>
        btn.setButtonText('Cancel').onClick(() => {
          this.resolve?.(null);
          this.close();
        })
      );
  }

  onClose(): void {
    this.contentEl.empty();
    this.resolve?.(null);
  }

  waitForSelection(): Promise<ParserSelectResult | null> {
    return new Promise((resolve) => {
      this.resolve = resolve;
    });
  }
}
