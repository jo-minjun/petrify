import { type App, type Plugin, PluginSettingTab, Setting } from 'obsidian';
import { ParserId } from './parser-registry.js';
import {
  DEFAULT_SETTINGS,
  LANGUAGE_HINT_OPTIONS,
  type LanguageHint,
  type OcrProvider,
  type OutputFormat,
  type PetrifySettings,
  type WatchSourceType,
} from './settings.js';

export interface SettingsTabCallbacks {
  readonly getSettings: () => PetrifySettings;
  readonly saveSettings: (settings: PetrifySettings) => Promise<void>;
  readonly saveDataOnly: (settings: PetrifySettings) => Promise<void>;
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
    this.displayWatchMappings(containerEl);
    this.displayGoogleDriveSettings(containerEl);
    this.displayOcrSettings(containerEl);
    this.displayDeleteSettings(containerEl);
  }

  private displayGeneralSettings(containerEl: HTMLElement): void {
    containerEl.createEl('h2', { text: 'General Settings' });

    const settings = this.callbacks.getSettings();

    new Setting(containerEl)
      .setName('출력 포맷')
      .setDesc('변환 결과 파일 형식')
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
  }

  private displayWatchMappings(containerEl: HTMLElement): void {
    containerEl.createEl('h2', { text: 'Watch Directories' });

    const settings = this.callbacks.getSettings();

    settings.watchMappings.forEach((mapping, index) => {
      const mappingContainer = containerEl.createDiv({ cls: 'petrify-mapping' });

      new Setting(mappingContainer)
        .setName('Source Type')
        .setDesc('Watch a local directory or a Google Drive folder')
        .addDropdown((dropdown) =>
          dropdown
            .addOption('local', 'Local Directory')
            .addOption('google-drive', 'Google Drive Folder')
            .setValue(mapping.sourceType ?? 'local')
            .onChange(async (value) => {
              settings.watchMappings[index].sourceType = value as WatchSourceType;
              await this.callbacks.saveSettings(settings);
              this.display();
            }),
        );

      const isGoogleDrive = mapping.sourceType === 'google-drive';

      new Setting(mappingContainer)
        .setName(`${isGoogleDrive ? 'Google Drive Folder ID' : 'Watch Directory'} ${index + 1}`)
        .setDesc(
          isGoogleDrive
            ? 'Google Drive folder ID to watch'
            : 'External folder to watch for handwriting files',
        )
        .addToggle((toggle) =>
          toggle.setValue(mapping.enabled).onChange(async (value) => {
            settings.watchMappings[index].enabled = value;
            await this.callbacks.saveSettings(settings);
          }),
        )
        .addText((text) =>
          text
            .setPlaceholder(isGoogleDrive ? 'Google Drive Folder ID' : '/path/to/watch')
            .setValue(mapping.watchDir)
            .onChange(async (value) => {
              settings.watchMappings[index].watchDir = value;
              await this.callbacks.saveDataOnly(settings);
            }),
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
              await this.callbacks.saveDataOnly(settings);
            }),
        );

      new Setting(mappingContainer)
        .setName('Parser')
        .setDesc('File format parser for this directory')
        .addDropdown((dropdown) => {
          for (const id of Object.values(ParserId)) {
            dropdown.addOption(id, id);
          }
          dropdown.setValue(mapping.parserId || ParserId.Viwoods);
          dropdown.onChange(async (value) => {
            settings.watchMappings[index].parserId = value;
            await this.callbacks.saveSettings(settings);
          });
        });

      new Setting(mappingContainer).addButton((btn) =>
        btn
          .setButtonText('Remove')
          .setWarning()
          .onClick(async () => {
            settings.watchMappings.splice(index, 1);
            await this.callbacks.saveSettings(settings);
            this.display();
          }),
      );
    });

    new Setting(containerEl).addButton((btn) =>
      btn.setButtonText('Add Watch Directory').onClick(async () => {
        settings.watchMappings.push({
          watchDir: '',
          outputDir: '',
          enabled: false,
          parserId: ParserId.Viwoods,
          sourceType: 'local',
        });
        await this.callbacks.saveSettings(settings);
        this.display();
      }),
    );
  }

  private displayGoogleDriveSettings(containerEl: HTMLElement): void {
    containerEl.createEl('h2', { text: 'Google Drive Settings' });

    const settings = this.callbacks.getSettings();

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
      .setName('Poll Interval')
      .setDesc('How often to check for changes (in seconds)')
      .addDropdown((dropdown) =>
        dropdown
          .addOption('30000', '30 seconds')
          .addOption('60000', '1 minute')
          .addOption('120000', '2 minutes')
          .setValue(String(settings.googleDrive.pollIntervalMs))
          .onChange(async (value) => {
            settings.googleDrive.pollIntervalMs = Number(value);
            await this.callbacks.saveDataOnly(settings);
          }),
      );
  }

  private displayDeleteSettings(containerEl: HTMLElement): void {
    containerEl.createEl('h2', { text: 'File Management' });

    const settings = this.callbacks.getSettings();

    new Setting(containerEl)
      .setName('Delete converted files on source delete')
      .setDesc(
        'When a source file is deleted, move the converted .excalidraw.md file to trash. ' +
          'Add "keep: true" to a file\'s petrify frontmatter to protect it.',
      )
      .addToggle((toggle) =>
        toggle.setValue(settings.deleteConvertedOnSourceDelete).onChange(async (value) => {
          settings.deleteConvertedOnSourceDelete = value;
          await this.callbacks.saveSettings(settings);
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

    // 1. OCR Provider
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

    // 2. Google Vision API Key & Language Hints (Google Vision only)
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

    // 3. Confidence Threshold
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

    // 4. Save Button
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
