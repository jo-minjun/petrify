import type { GoogleDriveClient } from '@petrify/watcher-google-drive';
import { type App, Notice, type Plugin, PluginSettingTab, Setting } from 'obsidian';
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
  private pendingApiKey: string = DEFAULT_SETTINGS.ocr.googleVision.apiKey;
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
    containerEl.createEl('h2', { text: 'General' });

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
    containerEl.createEl('h2', { text: 'Watch Sources' });

    const settings = this.callbacks.getSettings();

    if (!this.hasPendingWatchEdits) {
      this.pendingLocalWatch = structuredClone(settings.localWatch);
      this.pendingGoogleDrive = structuredClone(settings.googleDrive);
      this.hasPendingWatchEdits = true;
    }

    this.displayLocalWatchSection(containerEl);
    this.displayGoogleDriveSection(containerEl);
    this.displayWatchSourcesSaveButton(containerEl);
  }

  private displayLocalWatchSection(containerEl: HTMLElement): void {
    new Setting(containerEl)
      .setName('Local File Watch')
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
      mappingContainer.style.border = '1px solid var(--background-modifier-border)';
      mappingContainer.style.borderRadius = '8px';
      mappingContainer.style.padding = '8px 12px';
      mappingContainer.style.marginBottom = '12px';

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
          text.inputEl.style.width = '100%';
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
      watchDirSetting.settingEl.style.flexWrap = 'wrap';
      watchDirSetting.controlEl.style.width = '100%';

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
          text.inputEl.style.width = '100%';
        })
        .addButton((btn) =>
          btn.setButtonText('Browse').onClick(async () => {
            // biome-ignore lint/suspicious/noExplicitAny: FileSystemAdapter.basePath exists at runtime but is not included in Obsidian type declarations
            const vaultPath = (this.app.vault.adapter as any).basePath as string;
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
      outputDirSetting.settingEl.style.flexWrap = 'wrap';
      outputDirSetting.controlEl.style.width = '100%';

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
    driveContainer.style.border = '1px solid var(--background-modifier-border)';
    driveContainer.style.borderRadius = '8px';
    driveContainer.style.padding = '8px 12px';
    driveContainer.style.marginBottom = '12px';
    driveContainer.style.marginLeft = '16px';

    new Setting(driveContainer)
      .setName('Client ID')
      .setDesc('OAuth2 Client ID from Google Cloud Console')
      .addText((text) =>
        text
          .setPlaceholder('Enter Client ID')
          .setValue(this.pendingGoogleDrive.clientId)
          .onChange((value) => {
            this.pendingGoogleDrive.clientId = value;
            this.updateWatchSaveButton();
          }),
      );

    new Setting(driveContainer)
      .setName('Client Secret')
      .setDesc('OAuth2 Client Secret from Google Cloud Console')
      .addText((text) => {
        text.inputEl.type = 'password';
        text
          .setPlaceholder('Enter Client Secret')
          .setValue(this.pendingGoogleDrive.clientSecret)
          .onChange((value) => {
            this.pendingGoogleDrive.clientSecret = value;
            this.updateWatchSaveButton();
          });
      });

    const authSetting = new Setting(driveContainer).setName('Authentication');
    this.callbacks.hasGoogleDriveTokens().then((hasTokens) => {
      authSetting.setDesc(hasTokens ? 'Authenticated' : 'Not authenticated');
    });
    authSetting.addButton((btn) =>
      btn.setButtonText('Authenticate').onClick(() => {
        const { clientId, clientSecret } = this.pendingGoogleDrive;
        if (!clientId || !clientSecret) {
          new Notice('Enter Client ID and Client Secret first');
          return;
        }
        const authUrl = this.callbacks.getGoogleDriveAuthUrl(clientId, clientSecret);
        window.open(authUrl);
        new AuthCodeModal(this.app, async (code) => {
          try {
            await this.callbacks.handleGoogleDriveAuthCode(clientId, clientSecret, code);
            new Notice('Google Drive authenticated successfully');
            this.display();
          } catch (e) {
            new Notice(
              `Authentication failed: ${e instanceof Error ? e.message : 'Unknown error'}`,
            );
          }
        }).open();
      }),
    );

    new Setting(driveContainer)
      .setName('Auto Polling')
      .setDesc('Automatically poll for changes in Google Drive')
      .addToggle((toggle) =>
        toggle.setValue(this.pendingGoogleDrive.autoPolling).onChange((value) => {
          this.pendingGoogleDrive.autoPolling = value;
          this.display();
        }),
      );

    if (this.pendingGoogleDrive.autoPolling) {
      new Setting(driveContainer)
        .setName('Poll Interval')
        .setDesc('Minutes between polling (1-60)')
        .addText((text) => {
          text.inputEl.type = 'number';
          text.inputEl.min = '1';
          text.inputEl.max = '60';
          text.inputEl.step = '1';
          text.setValue(String(this.pendingGoogleDrive.pollIntervalMinutes)).onChange((value) => {
            const num = Number(value);
            const valid = !Number.isNaN(num) && num >= 1 && num <= 60;
            text.inputEl.style.borderColor = valid ? '' : 'var(--text-error)';
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
      mappingContainer.style.border = '1px solid var(--background-modifier-border)';
      mappingContainer.style.borderRadius = '8px';
      mappingContainer.style.padding = '8px 12px';
      mappingContainer.style.marginBottom = '12px';

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
            const { clientId, clientSecret } = this.pendingGoogleDrive;
            if (!clientId || !clientSecret) {
              new Notice('Enter Client ID and Client Secret first');
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
    const hasChanges =
      JSON.stringify({
        localWatch: this.pendingLocalWatch,
        googleDrive: this.pendingGoogleDrive,
      }) !==
      JSON.stringify({
        localWatch: settings.localWatch,
        googleDrive: settings.googleDrive,
      });
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
      const isValid = !isGoogleVision || hasApiKey;

      const hasChanges =
        this.pendingProvider !== settings.ocr.provider ||
        this.pendingApiKey !== settings.ocr.googleVision.apiKey ||
        JSON.stringify(this.pendingLanguageHints) !==
          JSON.stringify(settings.ocr.googleVision.languageHints) ||
        this.pendingConfidenceThreshold !== settings.ocr.confidenceThreshold;

      const canSave = isValid && hasChanges;
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
        tagContainer.style.display = 'flex';
        tagContainer.style.flexWrap = 'wrap';
        tagContainer.style.gap = '4px';
        tagContainer.style.marginBottom = '12px';

        for (const hint of this.pendingLanguageHints) {
          const option = LANGUAGE_HINT_OPTIONS.find((o) => o.value === hint);
          if (!option) continue;

          const tag = tagContainer.createDiv({ cls: 'petrify-language-tag' });
          tag.style.display = 'inline-flex';
          tag.style.alignItems = 'center';
          tag.style.gap = '4px';
          tag.style.padding = '2px 8px';
          tag.style.borderRadius = '12px';
          tag.style.backgroundColor = 'var(--background-modifier-hover)';
          tag.style.fontSize = '12px';

          tag.createSpan({ text: option.label });

          const removeBtn = tag.createEl('span', { text: '\u00d7', cls: 'petrify-tag-remove' });
          removeBtn.style.cursor = 'pointer';
          removeBtn.style.fontWeight = 'bold';
          removeBtn.style.marginLeft = '2px';
          removeBtn.addEventListener('click', () => {
            this.pendingLanguageHints = this.pendingLanguageHints.filter((h) => h !== hint);
            updateSaveButton();
            this.display();
          });
        }
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
            const valid = !Number.isNaN(num) && num >= 0 && num <= 100;
            text.inputEl.style.borderColor = valid ? '' : 'var(--text-error)';
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
          settings.ocr.googleVision.apiKey = this.pendingApiKey;
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
