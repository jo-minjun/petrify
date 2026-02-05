import { App, Plugin, PluginSettingTab, Setting } from 'obsidian';
import type { PetrifySettings } from './settings.js';

export interface SettingsTabCallbacks {
  getSettings: () => PetrifySettings;
  saveSettings: (settings: PetrifySettings) => Promise<void>;
}

export class PetrifySettingsTab extends PluginSettingTab {
  private readonly callbacks: SettingsTabCallbacks;

  constructor(app: App, plugin: Plugin, callbacks: SettingsTabCallbacks) {
    super(app, plugin);
    this.callbacks = callbacks;
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();

    this.displayWatchMappings(containerEl);
    this.displayOcrSettings(containerEl);
  }

  private displayWatchMappings(containerEl: HTMLElement): void {
    containerEl.createEl('h2', { text: 'Watch Directories' });

    const settings = this.callbacks.getSettings();

    settings.watchMappings.forEach((mapping, index) => {
      const mappingContainer = containerEl.createDiv({ cls: 'petrify-mapping' });

      new Setting(mappingContainer)
        .setName(`Watch Directory ${index + 1}`)
        .setDesc('External folder to watch for handwriting files')
        .addText((text) =>
          text
            .setPlaceholder('/path/to/watch')
            .setValue(mapping.watchDir)
            .onChange(async (value) => {
              settings.watchMappings[index].watchDir = value;
              await this.callbacks.saveSettings(settings);
            })
        );

      new Setting(mappingContainer)
        .setName('Output Directory')
        .setDesc('Folder in vault for converted files')
        .addText((text) =>
          text
            .setPlaceholder('Handwritings/')
            .setValue(mapping.outputDir)
            .onChange(async (value) => {
              settings.watchMappings[index].outputDir = value;
              await this.callbacks.saveSettings(settings);
            })
        );

      new Setting(mappingContainer).addButton((btn) =>
        btn
          .setButtonText('Remove')
          .setWarning()
          .onClick(async () => {
            settings.watchMappings.splice(index, 1);
            await this.callbacks.saveSettings(settings);
            this.display();
          })
      );
    });

    new Setting(containerEl).addButton((btn) =>
      btn.setButtonText('Add Watch Directory').onClick(async () => {
        settings.watchMappings.push({ watchDir: '', outputDir: '' });
        await this.callbacks.saveSettings(settings);
        this.display();
      })
    );
  }

  private displayOcrSettings(containerEl: HTMLElement): void {
    containerEl.createEl('h2', { text: 'OCR Settings' });

    const settings = this.callbacks.getSettings();

    new Setting(containerEl)
      .setName('Confidence Threshold')
      .setDesc('Minimum OCR confidence (0-100)')
      .addText((text) =>
        text
          .setPlaceholder('50')
          .setValue(String(settings.ocr.confidenceThreshold))
          .onChange(async (value) => {
            const num = Number(value);
            if (!Number.isNaN(num) && num >= 0 && num <= 100) {
              settings.ocr.confidenceThreshold = num;
              await this.callbacks.saveSettings(settings);
            }
          })
      );
  }
}
