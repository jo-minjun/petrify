import type { GoogleDriveClient } from '@petrify/watcher-google-drive';
import {
  type App,
  type DataAdapter,
  Notice,
  type Plugin,
  PluginSettingTab,
  Setting,
} from 'obsidian';
import { AuthCodeModal } from './auth-code-modal.js';
import { FolderBrowseModal } from './folder-browse-modal.js';
import { showNativeFolderDialog } from './native-folder-dialog.js';
import { ParserId } from './parser-registry.js';
import {
  DEFAULT_SETTINGS,
  type GoogleDriveSettings,
  LANGUAGE_HINT_OPTIONS,
  type LanguageHint,
  type LocalWatchSettings,
  type OcrProvider,
  type OutputFormat,
  type PetrifySettings,
} from './settings.js';

export interface SettingsTabCallbacks {
  readonly getSettings: () => PetrifySettings;
  readonly saveSettings: (settings: PetrifySettings) => Promise<void>;
  readonly saveDataOnly: (settings: PetrifySettings) => Promise<void>;
  readonly getGoogleDriveClient: (
    clientId: string,
    clientSecret: string,
  ) => Promise<GoogleDriveClient | null>;
  readonly getGoogleDriveAuthUrl: (clientId: string, clientSecret: string) => string;
  readonly handleGoogleDriveAuthCode: (
    clientId: string,
    clientSecret: string,
    code: string,
  ) => Promise<void>;
  readonly hasGoogleDriveTokens: () => Promise<boolean>;
}

export class PetrifySettingsTab extends PluginSettingTab {
  private readonly callbacks: SettingsTabCallbacks;

  private pendingProvider: OcrProvider = DEFAULT_SETTINGS.ocr.provider;
  private pendingApiKey = '';
  private pendingLanguageHints: LanguageHint[] = [
    ...DEFAULT_SETTINGS.ocr.googleVision.languageHints,
  ];
  private pendingConfidenceThreshold: number = DEFAULT_SETTINGS.ocr.confidenceThreshold;
  private hasPendingOcrEdits = false;

  private pendingOutputFormat: OutputFormat = DEFAULT_SETTINGS.outputFormat;
  private hasPendingGeneralEdits = false;
  private generalSaveButton: HTMLButtonElement | null = null;

  private pendingLocalWatch: LocalWatchSettings = structuredClone(DEFAULT_SETTINGS.localWatch);
  private pendingGoogleDrive: GoogleDriveSettings = structuredClone(DEFAULT_SETTINGS.googleDrive);
  private pendingClientSecret = '';
  private hasPendingWatchEdits = false;
  private watchSaveButton: HTMLButtonElement | null = null;

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
    new Setting(containerEl).setName('Output').setHeading();

    const settings = this.callbacks.getSettings();

    if (!this.hasPendingGeneralEdits) {
      this.pendingOutputFormat = settings.outputFormat;
      this.hasPendingGeneralEdits = true;
    }

    new Setting(containerEl)
      .setName('Output format')
      .setDesc('File format for converted output')
      .addDropdown((dropdown) =>
        dropdown
          .addOption('excalidraw', 'Excalidraw (.excalidraw.md)')
          .addOption('markdown', 'Markdown (.md)')
          .setValue(this.pendingOutputFormat)
          .onChange((value) => {
            this.pendingOutputFormat = value as OutputFormat;
            this.updateGeneralSaveButton();
          }),
      );

    new Setting(containerEl).addButton((btn) => {
      this.generalSaveButton = btn.buttonEl;
      btn
        .setButtonText('Save')
        .setCta()
        .onClick(async () => {
          settings.outputFormat = this.pendingOutputFormat;
          await this.callbacks.saveSettings(settings);
          this.hasPendingGeneralEdits = false;
          this.display();
        });
    });

    this.updateGeneralSaveButton();
  }

  private updateGeneralSaveButton(): void {
    if (!this.generalSaveButton) return;
    const settings = this.callbacks.getSettings();
    const hasChanges = this.pendingOutputFormat !== settings.outputFormat;
    this.generalSaveButton.disabled = !hasChanges;
    this.generalSaveButton.toggleClass('is-disabled', !hasChanges);
  }

  private displayWatchSourcesSettings(containerEl: HTMLElement): void {
    new Setting(containerEl).setName('Watch sources').setHeading();

    const settings = this.callbacks.getSettings();

    if (!this.hasPendingWatchEdits) {
      this.pendingLocalWatch = structuredClone(settings.localWatch);
      this.pendingGoogleDrive = structuredClone(settings.googleDrive);
      this.pendingClientSecret =
        this.app.secretStorage.getSecret('petrify-drive-client-secret') ?? '';
      this.hasPendingWatchEdits = true;
    }

    this.displayLocalWatchSection(containerEl);
    this.displayGoogleDriveSection(containerEl);
    this.displayWatchSourcesSaveButton(containerEl);
  }

  private displayLocalWatchSection(containerEl: HTMLElement): void {
    new Setting(containerEl)
      .setName('Local file watch')
      .setDesc('Watch local directories for file changes')
      .addToggle((toggle) =>
        toggle.setValue(this.pendingLocalWatch.enabled).onChange((value) => {
          this.pendingLocalWatch.enabled = value;
          this.display();
        }),
      );

    if (!this.pendingLocalWatch.enabled) return;

    new Setting(containerEl).addButton((btn) =>
      btn.setButtonText('Add mapping').onClick(() => {
        this.pendingLocalWatch.mappings.push({
          watchDir: '',
          outputDir: '',
          enabled: true,
          parserId: ParserId.Viwoods,
        });
        this.display();
      }),
    );

    this.pendingLocalWatch.mappings.forEach((mapping, index) => {
      const mappingContainer = containerEl.createDiv({ cls: 'petrify-mapping' });

      new Setting(mappingContainer)
        .setName(`Mapping #${index + 1}`)
        .addToggle((toggle) =>
          toggle.setValue(mapping.enabled).onChange((value) => {
            this.pendingLocalWatch.mappings[index].enabled = value;
            this.updateWatchSaveButton();
          }),
        )
        .addButton((btn) =>
          btn
            .setButtonText('Remove')
            .setWarning()
            .onClick(() => {
              this.pendingLocalWatch.mappings.splice(index, 1);
              this.display();
            }),
        );

      const watchDirSetting = new Setting(mappingContainer)
        .setName('Watch directory')
        .addText((text) => {
          text
            .setPlaceholder('/path/to/watch')
            .setValue(mapping.watchDir)
            .onChange((value) => {
              this.pendingLocalWatch.mappings[index].watchDir = value;
              this.updateWatchSaveButton();
            });
          text.inputEl.addClass('petrify-input-full-width');
        })
        .addButton((btn) =>
          btn.setButtonText('Browse').onClick(async () => {
            const selected = await showNativeFolderDialog(mapping.watchDir || undefined);
            if (!selected) return;
            this.pendingLocalWatch.mappings[index].watchDir = selected;
            this.updateWatchSaveButton();
            this.display();
          }),
        );
      watchDirSetting.settingEl.addClass('petrify-setting-full-width');

      const outputDirSetting = new Setting(mappingContainer)
        .setName('Output directory')
        .addText((text) => {
          text
            .setPlaceholder('Handwritings/')
            .setValue(mapping.outputDir)
            .onChange((value) => {
              this.pendingLocalWatch.mappings[index].outputDir = value;
              this.updateWatchSaveButton();
            });
          text.inputEl.addClass('petrify-input-full-width');
        })
        .addButton((btn) =>
          btn.setButtonText('Browse').onClick(async () => {
            const vaultPath = (
              this.app.vault.adapter as DataAdapter & { getBasePath(): string }
            ).getBasePath();
            const selected = await showNativeFolderDialog(vaultPath);
            if (!selected) return;
            const relative = selected.startsWith(vaultPath)
              ? selected.slice(vaultPath.length + 1)
              : selected;
            this.pendingLocalWatch.mappings[index].outputDir = relative;
            this.updateWatchSaveButton();
            this.display();
          }),
        );
      outputDirSetting.settingEl.addClass('petrify-setting-full-width');

      new Setting(mappingContainer).setName('Parser').addDropdown((dropdown) => {
        for (const id of Object.values(ParserId)) {
          dropdown.addOption(id, id);
        }
        dropdown.setValue(mapping.parserId || ParserId.Viwoods);
        dropdown.onChange((value) => {
          this.pendingLocalWatch.mappings[index].parserId = value;
          this.updateWatchSaveButton();
        });
      });
    });
  }

  private displayGoogleDriveSection(containerEl: HTMLElement): void {
    new Setting(containerEl)
      .setName('Google Drive API')
      .setDesc('Sync and convert files from Google Drive')
      .addToggle((toggle) =>
        toggle.setValue(this.pendingGoogleDrive.enabled).onChange((value) => {
          this.pendingGoogleDrive.enabled = value;
          this.display();
        }),
      );

    if (!this.pendingGoogleDrive.enabled) return;

    const driveContainer = containerEl.createDiv({ cls: 'petrify-drive-settings' });

    new Setting(driveContainer)
      .setName('Client ID')
      .setDesc('OAuth2 client ID from Google cloud console')
      .addText((text) =>
        text
          .setPlaceholder('Enter client ID')
          .setValue(this.pendingGoogleDrive.clientId)
          .onChange((value) => {
            this.pendingGoogleDrive.clientId = value;
            this.updateWatchSaveButton();
          }),
      );

    new Setting(driveContainer)
      .setName('Client secret')
      .setDesc('OAuth2 client secret from Google cloud console')
      .addText((text) => {
        text.inputEl.type = 'password';
        text
          .setPlaceholder('Enter client secret')
          .setValue(this.pendingClientSecret)
          .onChange((value) => {
            this.pendingClientSecret = value;
            this.updateWatchSaveButton();
          });
      });

    const authSetting = new Setting(driveContainer).setName('Authentication');
    void this.callbacks
      .hasGoogleDriveTokens()
      .then((hasTokens) => {
        authSetting.setDesc(hasTokens ? 'Authenticated' : 'Not authenticated');
      })
      .catch(() => {
        authSetting.setDesc('Not authenticated');
      });
    authSetting.addButton((btn) =>
      btn.setButtonText('Authenticate').onClick(() => {
        const { clientId } = this.pendingGoogleDrive;
        const clientSecret = this.pendingClientSecret;
        if (!clientId || !clientSecret) {
          new Notice('Enter client ID and client secret first');
          return;
        }
        const authUrl = this.callbacks.getGoogleDriveAuthUrl(clientId, clientSecret);
        window.open(authUrl);
        new AuthCodeModal(this.app, (code) => {
          this.callbacks
            .handleGoogleDriveAuthCode(clientId, clientSecret, code)
            .then(() => {
              new Notice('Google Drive authenticated successfully');
              this.display();
            })
            .catch((e: unknown) => {
              new Notice(
                `Authentication failed: ${e instanceof Error ? e.message : 'Unknown error'}`,
              );
            });
        }).open();
      }),
    );

    new Setting(driveContainer)
      .setName('Auto polling')
      .setDesc('Automatically poll for changes in Google Drive')
      .addToggle((toggle) =>
        toggle.setValue(this.pendingGoogleDrive.autoPolling).onChange((value) => {
          this.pendingGoogleDrive.autoPolling = value;
          this.display();
        }),
      );

    if (this.pendingGoogleDrive.autoPolling) {
      new Setting(driveContainer)
        .setName('Poll interval')
        .setDesc('Minutes between polling (1-60)')
        .addText((text) => {
          text.inputEl.type = 'number';
          text.inputEl.min = '1';
          text.inputEl.max = '60';
          text.inputEl.step = '1';
          text.setValue(String(this.pendingGoogleDrive.pollIntervalMinutes)).onChange((value) => {
            const num = Number(value);
            const valid = !Number.isNaN(num) && num >= 1 && num <= 60;
            text.inputEl.toggleClass('petrify-input-error', !valid);
            if (valid) {
              this.pendingGoogleDrive.pollIntervalMinutes = num;
            }
            this.updateWatchSaveButton();
          });
        });
    }

    new Setting(driveContainer).addButton((btn) =>
      btn.setButtonText('Add mapping').onClick(() => {
        this.pendingGoogleDrive.mappings.push({
          folderId: '',
          folderName: '',
          outputDir: '',
          enabled: true,
          parserId: ParserId.Viwoods,
        });
        this.display();
      }),
    );

    this.pendingGoogleDrive.mappings.forEach((mapping, index) => {
      const mappingContainer = driveContainer.createDiv({ cls: 'petrify-mapping' });

      new Setting(mappingContainer)
        .setName(`Mapping #${index + 1}`)
        .addToggle((toggle) =>
          toggle.setValue(mapping.enabled).onChange((value) => {
            this.pendingGoogleDrive.mappings[index].enabled = value;
            this.updateWatchSaveButton();
          }),
        )
        .addButton((btn) =>
          btn
            .setButtonText('Remove')
            .setWarning()
            .onClick(() => {
              this.pendingGoogleDrive.mappings.splice(index, 1);
              this.display();
            }),
        );

      new Setting(mappingContainer)
        .setName('Folder')
        .setDesc(mapping.folderName || 'No folder selected')
        .addButton((btn) =>
          btn.setButtonText('Browse').onClick(async () => {
            const { clientId } = this.pendingGoogleDrive;
            const clientSecret = this.pendingClientSecret;
            if (!clientId || !clientSecret) {
              new Notice('Enter client ID and client secret first');
              return;
            }
            const client = await this.callbacks.getGoogleDriveClient(clientId, clientSecret);
            if (!client) {
              new Notice('Please authenticate with Google Drive first');
              return;
            }
            new FolderBrowseModal(this.app, client, (result) => {
              this.pendingGoogleDrive.mappings[index].folderId = result.folderId;
              this.pendingGoogleDrive.mappings[index].folderName = result.folderName;
              this.display();
            }).open();
          }),
        );

      new Setting(mappingContainer).setName('Output directory').addText((text) =>
        text
          .setPlaceholder('Handwritings/')
          .setValue(mapping.outputDir)
          .onChange((value) => {
            this.pendingGoogleDrive.mappings[index].outputDir = value;
            this.updateWatchSaveButton();
          }),
      );

      new Setting(mappingContainer).setName('Parser').addDropdown((dropdown) => {
        for (const id of Object.values(ParserId)) {
          dropdown.addOption(id, id);
        }
        dropdown.setValue(mapping.parserId || ParserId.Viwoods);
        dropdown.onChange((value) => {
          this.pendingGoogleDrive.mappings[index].parserId = value;
          this.updateWatchSaveButton();
        });
      });
    });
  }

  private displayWatchSourcesSaveButton(containerEl: HTMLElement): void {
    const settings = this.callbacks.getSettings();

    new Setting(containerEl).addButton((btn) => {
      this.watchSaveButton = btn.buttonEl;
      btn
        .setButtonText('Save')
        .setCta()
        .onClick(async () => {
          settings.localWatch = structuredClone(this.pendingLocalWatch);
          settings.googleDrive = structuredClone(this.pendingGoogleDrive);
          this.app.secretStorage.setSecret('petrify-drive-client-secret', this.pendingClientSecret);
          await this.callbacks.saveSettings(settings);
          this.hasPendingWatchEdits = false;
          this.display();
        });
    });

    this.updateWatchSaveButton();
  }

  private updateWatchSaveButton(): void {
    if (!this.watchSaveButton) return;
    const settings = this.callbacks.getSettings();
    const currentClientSecret =
      this.app.secretStorage.getSecret('petrify-drive-client-secret') ?? '';
    const hasChanges =
      JSON.stringify({
        localWatch: this.pendingLocalWatch,
        googleDrive: this.pendingGoogleDrive,
      }) !==
        JSON.stringify({
          localWatch: settings.localWatch,
          googleDrive: settings.googleDrive,
        }) || this.pendingClientSecret !== currentClientSecret;
    const isValid = this.isWatchSourcesValid();
    const canSave = hasChanges && isValid;
    this.watchSaveButton.disabled = !canSave;
    this.watchSaveButton.toggleClass('is-disabled', !canSave);
  }

  private isWatchSourcesValid(): boolean {
    if (this.pendingGoogleDrive.enabled && this.pendingGoogleDrive.autoPolling) {
      const interval = this.pendingGoogleDrive.pollIntervalMinutes;
      if (Number.isNaN(interval) || interval < 1 || interval > 60) return false;
    }
    return true;
  }

  private displayOcrSettings(containerEl: HTMLElement): void {
    new Setting(containerEl).setName('OCR').setHeading();

    const settings = this.callbacks.getSettings();

    if (!this.hasPendingOcrEdits) {
      this.pendingProvider = settings.ocr.provider;
      this.pendingApiKey = this.app.secretStorage.getSecret('petrify-vision-api-key') ?? '';
      this.pendingLanguageHints = [...settings.ocr.googleVision.languageHints];
      this.pendingConfidenceThreshold = settings.ocr.confidenceThreshold;
      this.hasPendingOcrEdits = true;
    }

    let saveButton: HTMLButtonElement | null = null;

    const updateSaveButton = () => {
      if (!saveButton) return;
      const isGoogleVision = this.pendingProvider === 'google-vision';
      const hasApiKey = this.pendingApiKey.trim().length > 0;
      const isValid = !isGoogleVision || hasApiKey;

      const currentApiKey = this.app.secretStorage.getSecret('petrify-vision-api-key') ?? '';
      const hasChanges =
        this.pendingProvider !== settings.ocr.provider ||
        this.pendingApiKey !== currentApiKey ||
        JSON.stringify(this.pendingLanguageHints) !==
          JSON.stringify(settings.ocr.googleVision.languageHints) ||
        this.pendingConfidenceThreshold !== settings.ocr.confidenceThreshold;

      const canSave = isValid && hasChanges;
      saveButton.disabled = !canSave;
      saveButton.toggleClass('is-disabled', !canSave);
    };

    new Setting(containerEl)
      .setName('OCR provider')
      .setDesc('Engine for text recognition')
      .addDropdown((dropdown) => {
        dropdown
          .addOption('tesseract', 'Tesseract (local)')
          .addOption('google-vision', 'Google vision API')
          .setValue(this.pendingProvider)
          .onChange((value) => {
            this.pendingProvider = value as OcrProvider;
            updateSaveButton();
            this.display();
          });
      });

    if (this.pendingProvider === 'google-vision') {
      new Setting(containerEl)
        .setName('Google vision API key')
        .setDesc('Google cloud vision API key')
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
        .setName('Language hints')
        .setDesc('Preferred languages for recognition');

      const unselected = LANGUAGE_HINT_OPTIONS.filter(
        (opt) => !this.pendingLanguageHints.includes(opt.value),
      );

      if (unselected.length > 0) {
        languageSetting.addDropdown((dropdown) => {
          dropdown.addOption('', 'Add language...');
          for (const opt of unselected) {
            dropdown.addOption(opt.value, opt.label);
          }
          dropdown.onChange((value) => {
            if (value && !this.pendingLanguageHints.includes(value as LanguageHint)) {
              this.pendingLanguageHints.push(value as LanguageHint);
              updateSaveButton();
              this.display();
            }
          });
        });
      }

      if (this.pendingLanguageHints.length > 0) {
        const tagContainer = containerEl.createDiv({ cls: 'petrify-language-tags' });

        for (const hint of this.pendingLanguageHints) {
          const option = LANGUAGE_HINT_OPTIONS.find((o) => o.value === hint);
          if (!option) continue;

          const tag = tagContainer.createDiv({ cls: 'petrify-language-tag' });
          tag.createSpan({ text: option.label });

          const removeBtn = tag.createEl('span', { text: '\u00d7', cls: 'petrify-tag-remove' });
          removeBtn.addEventListener('click', () => {
            this.pendingLanguageHints = this.pendingLanguageHints.filter((h) => h !== hint);
            updateSaveButton();
            this.display();
          });
        }
      }
    }

    new Setting(containerEl)
      .setName('Confidence threshold')
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
            const valid = !Number.isNaN(num) && num >= 0 && num <= 100;
            text.inputEl.toggleClass('petrify-input-error', !valid);
            if (valid) {
              this.pendingConfidenceThreshold = num;
            }
            updateSaveButton();
          });
      });

    new Setting(containerEl).addButton((btn) => {
      saveButton = btn.buttonEl;
      btn
        .setButtonText('Save')
        .setCta()
        .onClick(async () => {
          settings.ocr.provider = this.pendingProvider;
          this.app.secretStorage.setSecret('petrify-vision-api-key', this.pendingApiKey);
          settings.ocr.googleVision.languageHints = this.pendingLanguageHints;
          settings.ocr.confidenceThreshold = this.pendingConfidenceThreshold;
          await this.callbacks.saveSettings(settings);
          this.hasPendingOcrEdits = false;
          this.display();
        });
    });

    updateSaveButton();
  }
}
