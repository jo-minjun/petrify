import { App, PluginSettingTab, Setting } from 'obsidian';
import type { PetrifySettings } from './settings.js';

export interface SettingsTabCallbacks {
  getSettings: () => PetrifySettings;
  saveSettings: (settings: PetrifySettings) => Promise<void>;
}

export class PetrifySettingsTab extends PluginSettingTab {
  private readonly callbacks: SettingsTabCallbacks;

  constructor(app: App, plugin: { manifest: { id: string; name: string } }, callbacks: SettingsTabCallbacks) {
    super(app, plugin as any);
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
      .setName('OCR Provider')
      .setDesc('Select OCR engine')
      .addDropdown((dropdown) =>
        dropdown
          .addOption('gutenye', 'Gutenye (Local)')
          .addOption('google-vision', 'Google Vision API')
          .addOption('azure-ocr', 'Azure OCR')
          .setValue(settings.ocr.provider)
          .onChange(async (value) => {
            settings.ocr.provider = value as 'gutenye' | 'google-vision' | 'azure-ocr';
            await this.callbacks.saveSettings(settings);
            this.display();
          })
      );

    new Setting(containerEl)
      .setName('Confidence Threshold')
      .setDesc('Minimum OCR confidence (0-100)')
      .addSlider((slider) =>
        slider
          .setLimits(0, 100, 5)
          .setValue(settings.ocr.confidenceThreshold)
          .setDynamicTooltip()
          .onChange(async (value) => {
            settings.ocr.confidenceThreshold = value;
            await this.callbacks.saveSettings(settings);
          })
      );

    this.displayProviderConfig(containerEl, settings);
  }

  private displayProviderConfig(containerEl: HTMLElement, settings: PetrifySettings): void {
    if (settings.ocr.provider === 'google-vision') {
      new Setting(containerEl)
        .setName('Google Vision API Key')
        .setDesc('API key for Google Cloud Vision')
        .addText((text) =>
          text
            .setPlaceholder('Enter API key')
            .setValue(settings.ocr.providerConfig.googleVision?.apiKey ?? '')
            .onChange(async (value) => {
              settings.ocr.providerConfig.googleVision = { apiKey: value };
              await this.callbacks.saveSettings(settings);
            })
        );
    }

    if (settings.ocr.provider === 'azure-ocr') {
      new Setting(containerEl)
        .setName('Azure OCR API Key')
        .addText((text) =>
          text
            .setPlaceholder('Enter API key')
            .setValue(settings.ocr.providerConfig.azureOcr?.apiKey ?? '')
            .onChange(async (value) => {
              settings.ocr.providerConfig.azureOcr = {
                ...settings.ocr.providerConfig.azureOcr,
                apiKey: value,
                endpoint: settings.ocr.providerConfig.azureOcr?.endpoint ?? '',
              };
              await this.callbacks.saveSettings(settings);
            })
        );

      new Setting(containerEl)
        .setName('Azure OCR Endpoint')
        .addText((text) =>
          text
            .setPlaceholder('https://your-resource.cognitiveservices.azure.com')
            .setValue(settings.ocr.providerConfig.azureOcr?.endpoint ?? '')
            .onChange(async (value) => {
              settings.ocr.providerConfig.azureOcr = {
                ...settings.ocr.providerConfig.azureOcr,
                apiKey: settings.ocr.providerConfig.azureOcr?.apiKey ?? '',
                endpoint: value,
              };
              await this.callbacks.saveSettings(settings);
            })
        );
    }
  }
}
