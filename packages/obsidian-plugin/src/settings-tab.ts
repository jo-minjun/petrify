import type { GoogleDriveClient } from '@petrify/watcher-google-drive';
import { type App, Notice, type Plugin, PluginSettingTab, Setting } from 'obsidian';
import { FolderBrowseModal } from './folder-browse-modal.js';
import { ParserId } from './parser-registry.js';
import {
  DEFAULT_SETTINGS,
  LANGUAGE_HINT_OPTIONS,
  type LanguageHint,
  type OcrProvider,
  type OutputFormat,
  type PetrifySettings,
} from './settings.js';

export interface SettingsTabCallbacks {
  readonly getSettings: () => PetrifySettings;
  readonly saveSettings: (settings: PetrifySettings) => Promise<void>;
  readonly saveDataOnly: (settings: PetrifySettings) => Promise<void>;
  readonly getGoogleDriveClient: () => Promise<GoogleDriveClient | null>;
}

export class PetrifySettingsTab extends PluginSettingTab {
  private readonly callbacks: SettingsTabCallbacks;

  private pendingProvider: OcrProvider = DEFAULT_SETTINGS.ocr.provider;
  private pendingApiKey: string = DEFAULT_SETTINGS.ocr.googleVision.apiKey;
  private pendingLanguageHints: LanguageHint[] = [
    ...DEFAULT_SETTINGS.ocr.googleVision.languageHints,
  ];
  private pendingConfidenceThreshold: number = DEFAULT_SETTINGS.ocr.confidenceThreshold;
  private hasPendingOcrEdits = false;

  constructor(app: App, plugin: Plugin, callbacks: SettingsTabCallbacks) {
    super(app, plugin);
    this.callbacks = callbacks;
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();

    this.displayGeneralSettings(containerEl);
    this.displayWatchSourcesSettings(containerEl);
    this.displayOcrSettings(containerEl);
  }

  private displayGeneralSettings(containerEl: HTMLElement): void {
    containerEl.createEl('h2', { text: 'General' });

    const settings = this.callbacks.getSettings();

    new Setting(containerEl)
      .setName('Output format')
      .setDesc('File format for converted output')
      .addDropdown((dropdown) =>
        dropdown
          .addOption('excalidraw', 'Excalidraw (.excalidraw.md)')
          .addOption('markdown', 'Markdown (.md)')
          .setValue(settings.outputFormat)
          .onChange(async (value) => {
            settings.outputFormat = value as OutputFormat;
            await this.callbacks.saveDataOnly(settings);
          }),
      );

    new Setting(containerEl)
      .setName('Auto-sync converted files')
      .setDesc(
        'Automatically update or delete converted files when the source changes or is removed. ' +
          "Files with 'keep: true' in frontmatter are excluded from both updates and deletions.",
      )
      .addToggle((toggle) =>
        toggle.setValue(settings.autoSync).onChange(async (value) => {
          settings.autoSync = value;
          await this.callbacks.saveSettings(settings);
        }),
      );
  }

  private displayWatchSourcesSettings(containerEl: HTMLElement): void {
    containerEl.createEl('h2', { text: 'Watch Sources' });

    const settings = this.callbacks.getSettings();

    this.displayLocalWatchSection(containerEl, settings);
    this.displayGoogleDriveSection(containerEl, settings);
  }

  private displayLocalWatchSection(containerEl: HTMLElement, settings: PetrifySettings): void {
    new Setting(containerEl).setName('Local File Watch').addToggle((toggle) =>
      toggle.setValue(settings.localWatch.enabled).onChange(async (value) => {
        settings.localWatch.enabled = value;
        await this.callbacks.saveSettings(settings);
        this.display();
      }),
    );

    if (!settings.localWatch.enabled) return;

    settings.localWatch.mappings.forEach((mapping, index) => {
      const mappingContainer = containerEl.createDiv({ cls: 'petrify-mapping' });

      new Setting(mappingContainer).setName('Watch directory').addText((text) =>
        text
          .setPlaceholder('/path/to/watch')
          .setValue(mapping.watchDir)
          .onChange(async (value) => {
            settings.localWatch.mappings[index].watchDir = value;
            await this.callbacks.saveDataOnly(settings);
          }),
      );

      new Setting(mappingContainer).setName('Output directory').addText((text) =>
        text
          .setPlaceholder('Handwritings/')
          .setValue(mapping.outputDir)
          .onChange(async (value) => {
            settings.localWatch.mappings[index].outputDir = value;
            await this.callbacks.saveDataOnly(settings);
          }),
      );

      new Setting(mappingContainer).setName('Parser').addDropdown((dropdown) => {
        for (const id of Object.values(ParserId)) {
          dropdown.addOption(id, id);
        }
        dropdown.setValue(mapping.parserId || ParserId.Viwoods);
        dropdown.onChange(async (value) => {
          settings.localWatch.mappings[index].parserId = value;
          await this.callbacks.saveSettings(settings);
        });
      });

      new Setting(mappingContainer)
        .addToggle((toggle) =>
          toggle.setValue(mapping.enabled).onChange(async (value) => {
            settings.localWatch.mappings[index].enabled = value;
            await this.callbacks.saveSettings(settings);
          }),
        )
        .addButton((btn) =>
          btn
            .setButtonText('Remove')
            .setWarning()
            .onClick(async () => {
              settings.localWatch.mappings.splice(index, 1);
              await this.callbacks.saveSettings(settings);
              this.display();
            }),
        );
    });

    new Setting(containerEl).addButton((btn) =>
      btn.setButtonText('Add mapping').onClick(async () => {
        settings.localWatch.mappings.push({
          watchDir: '',
          outputDir: '',
          enabled: false,
          parserId: ParserId.Viwoods,
        });
        await this.callbacks.saveSettings(settings);
        this.display();
      }),
    );
  }

  private displayGoogleDriveSection(containerEl: HTMLElement, settings: PetrifySettings): void {
    new Setting(containerEl).setName('Google Drive').addToggle((toggle) =>
      toggle.setValue(settings.googleDrive.enabled).onChange(async (value) => {
        settings.googleDrive.enabled = value;
        await this.callbacks.saveSettings(settings);
        this.display();
      }),
    );

    if (!settings.googleDrive.enabled) return;

    new Setting(containerEl)
      .setName('Client ID')
      .setDesc('OAuth2 Client ID from Google Cloud Console')
      .addText((text) =>
        text
          .setPlaceholder('Enter Client ID')
          .setValue(settings.googleDrive.clientId)
          .onChange(async (value) => {
            settings.googleDrive.clientId = value;
            await this.callbacks.saveDataOnly(settings);
          }),
      );

    new Setting(containerEl)
      .setName('Client Secret')
      .setDesc('OAuth2 Client Secret from Google Cloud Console')
      .addText((text) => {
        text.inputEl.type = 'password';
        text
          .setPlaceholder('Enter Client Secret')
          .setValue(settings.googleDrive.clientSecret)
          .onChange(async (value) => {
            settings.googleDrive.clientSecret = value;
            await this.callbacks.saveDataOnly(settings);
          });
      });

    new Setting(containerEl)
      .setName('Auto Polling')
      .setDesc('Automatically poll for changes in Google Drive')
      .addToggle((toggle) =>
        toggle.setValue(settings.googleDrive.autoPolling).onChange(async (value) => {
          settings.googleDrive.autoPolling = value;
          await this.callbacks.saveSettings(settings);
          this.display();
        }),
      );

    if (settings.googleDrive.autoPolling) {
      new Setting(containerEl)
        .setName('Poll Interval')
        .setDesc('Minutes between polling (1-60)')
        .addText((text) => {
          text.inputEl.type = 'number';
          text.inputEl.min = '1';
          text.inputEl.max = '60';
          text.inputEl.step = '1';
          text
            .setValue(String(settings.googleDrive.pollIntervalMinutes))
            .onChange(async (value) => {
              const num = Number(value);
              if (!Number.isNaN(num) && num >= 1 && num <= 60) {
                settings.googleDrive.pollIntervalMinutes = num;
                await this.callbacks.saveDataOnly(settings);
              }
            });
        });
    }

    settings.googleDrive.mappings.forEach((mapping, index) => {
      const mappingContainer = containerEl.createDiv({ cls: 'petrify-mapping' });

      new Setting(mappingContainer)
        .setName('Folder')
        .setDesc(mapping.folderName || 'No folder selected')
        .addButton((btn) =>
          btn.setButtonText('Browse').onClick(async () => {
            const client = await this.callbacks.getGoogleDriveClient();
            if (!client) {
              new Notice('Configure Client ID and Secret first');
              return;
            }
            new FolderBrowseModal(this.app, client, (result) => {
              settings.googleDrive.mappings[index].folderId = result.folderId;
              settings.googleDrive.mappings[index].folderName = result.folderName;
              this.callbacks.saveSettings(settings);
              this.display();
            }).open();
          }),
        );

      new Setting(mappingContainer).setName('Output directory').addText((text) =>
        text
          .setPlaceholder('Handwritings/')
          .setValue(mapping.outputDir)
          .onChange(async (value) => {
            settings.googleDrive.mappings[index].outputDir = value;
            await this.callbacks.saveDataOnly(settings);
          }),
      );

      new Setting(mappingContainer).setName('Parser').addDropdown((dropdown) => {
        for (const id of Object.values(ParserId)) {
          dropdown.addOption(id, id);
        }
        dropdown.setValue(mapping.parserId || ParserId.Viwoods);
        dropdown.onChange(async (value) => {
          settings.googleDrive.mappings[index].parserId = value;
          await this.callbacks.saveSettings(settings);
        });
      });

      new Setting(mappingContainer)
        .addToggle((toggle) =>
          toggle.setValue(mapping.enabled).onChange(async (value) => {
            settings.googleDrive.mappings[index].enabled = value;
            await this.callbacks.saveSettings(settings);
          }),
        )
        .addButton((btn) =>
          btn
            .setButtonText('Remove')
            .setWarning()
            .onClick(async () => {
              settings.googleDrive.mappings.splice(index, 1);
              await this.callbacks.saveSettings(settings);
              this.display();
            }),
        );
    });

    new Setting(containerEl).addButton((btn) =>
      btn.setButtonText('Add mapping').onClick(async () => {
        settings.googleDrive.mappings.push({
          folderId: '',
          folderName: '',
          outputDir: '',
          enabled: false,
          parserId: ParserId.Viwoods,
        });
        await this.callbacks.saveSettings(settings);
        this.display();
      }),
    );
  }

  private displayOcrSettings(containerEl: HTMLElement): void {
    containerEl.createEl('h2', { text: 'OCR Settings' });

    const settings = this.callbacks.getSettings();

    if (!this.hasPendingOcrEdits) {
      this.pendingProvider = settings.ocr.provider;
      this.pendingApiKey = settings.ocr.googleVision.apiKey;
      this.pendingLanguageHints = [...settings.ocr.googleVision.languageHints];
      this.pendingConfidenceThreshold = settings.ocr.confidenceThreshold;
      this.hasPendingOcrEdits = true;
    }

    let saveButton: HTMLButtonElement | null = null;

    const updateSaveButton = () => {
      if (!saveButton) return;
      const isGoogleVision = this.pendingProvider === 'google-vision';
      const hasApiKey = this.pendingApiKey.trim().length > 0;
      const canSave = !isGoogleVision || hasApiKey;
      saveButton.disabled = !canSave;
      saveButton.toggleClass('is-disabled', !canSave);
    };

    new Setting(containerEl)
      .setName('OCR Provider')
      .setDesc('Engine for text recognition')
      .addDropdown((dropdown) => {
        dropdown
          .addOption('tesseract', 'Tesseract (Local)')
          .addOption('google-vision', 'Google Vision API')
          .setValue(this.pendingProvider)
          .onChange((value) => {
            this.pendingProvider = value as OcrProvider;
            updateSaveButton();
            this.display();
          });
      });

    if (this.pendingProvider === 'google-vision') {
      new Setting(containerEl)
        .setName('Google Vision API Key')
        .setDesc('Google Cloud Vision API key')
        .addText((text) => {
          text.inputEl.type = 'password';
          text
            .setPlaceholder('Enter API key')
            .setValue(this.pendingApiKey)
            .onChange((value) => {
              this.pendingApiKey = value;
              updateSaveButton();
            });
        });

      const languageSetting = new Setting(containerEl)
        .setName('Language Hints')
        .setDesc('Preferred languages for recognition (multiple selection)');

      for (const option of LANGUAGE_HINT_OPTIONS) {
        languageSetting.addToggle((toggle) => {
          toggle
            .setValue(this.pendingLanguageHints.includes(option.value))
            .setTooltip(option.label)
            .onChange((enabled) => {
              if (enabled) {
                if (!this.pendingLanguageHints.includes(option.value)) {
                  this.pendingLanguageHints.push(option.value);
                }
              } else {
                this.pendingLanguageHints = this.pendingLanguageHints.filter(
                  (h) => h !== option.value,
                );
              }
            });
        });
      }
    }

    new Setting(containerEl)
      .setName('Confidence Threshold')
      .setDesc('Minimum OCR confidence (0-100)')
      .addText((text) => {
        text.inputEl.type = 'number';
        text.inputEl.min = '0';
        text.inputEl.max = '100';
        text.inputEl.step = '1';
        text
          .setPlaceholder(String(DEFAULT_SETTINGS.ocr.confidenceThreshold))
          .setValue(String(this.pendingConfidenceThreshold))
          .onChange((value) => {
            const num = Number(value);
            if (!Number.isNaN(num) && num >= 0 && num <= 100) {
              this.pendingConfidenceThreshold = num;
            }
          });
      });

    new Setting(containerEl).addButton((btn) => {
      saveButton = btn.buttonEl;
      btn
        .setButtonText('Save OCR Settings')
        .setCta()
        .onClick(async () => {
          settings.ocr.provider = this.pendingProvider;
          settings.ocr.googleVision.apiKey = this.pendingApiKey;
          settings.ocr.googleVision.languageHints = this.pendingLanguageHints;
          settings.ocr.confidenceThreshold = this.pendingConfidenceThreshold;
          await this.callbacks.saveSettings(settings);
          this.hasPendingOcrEdits = false;
        });
    });

    updateSaveButton();
  }
}
