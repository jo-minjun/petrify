# Petrify

Convert handwritten note app files to Obsidian Excalidraw.

## Introduction

Petrify converts handwriting note files into Excalidraw or Markdown format within Obsidian. It watches external folders for changes and automatically converts new or updated files into your vault.

**Currently supported:**
- Parser: Viwoods (.note)
- OCR: Tesseract.js (local), Google Cloud Vision (API)
- Output: Excalidraw (.excalidraw.md), Markdown (.md)
- Watcher: chokidar (local filesystem), Google Drive API (remote change detection)

**Planned:**
- Additional parsers for other handwriting note apps

## Obsidian Plugin

### Features

- **File watching**: Watch external folders and automatically convert new or updated files
- **Multi-folder mapping**: Map multiple external folders to different vault folders, each with its own parser
- **Drag & drop**: Drop handwriting files into the file explorer to convert them at the drop location
- **Sync command**: Manually trigger a full sync via the ribbon icon or command palette (`Petrify: Sync`)
- **OCR**: Extract handwritten text so your notes become searchable in Obsidian
- **Duplicate prevention**: Skips already-converted files by comparing modification time
- **Source delete sync**: Optionally remove converted files when the source file is deleted
- **Keep protection**: Mark converted files as protected via frontmatter (`keep: true`) to prevent deletion or re-conversion — toggle via command palette or file context menu

### Settings

| Setting | Description |
|---------|-------------|
| Output Format | Output file format (Excalidraw / Markdown) |
| Source Type | Watch source type per mapping (Local Directory / Google Drive Folder) |
| Watch Directories | External folder paths to watch (multiple mappings supported) |
| Output Directories | Vault paths for converted files (per mapping) |
| Parser | Parser to use for each watch folder (currently Viwoods only) |
| OCR Provider | OCR engine (Tesseract / Google Vision) |
| Google Vision API Key | API key for Google Cloud Vision (shown when Google Vision is selected) |
| Language Hints | OCR language hints for Google Vision (Korean, English, Japanese, Chinese) |
| Confidence Threshold | OCR confidence threshold (0–100, default: 50) |
| Delete on source delete | Delete converted file when source is deleted (default: off). Files with `keep: true` frontmatter are protected |
| Google Drive Client ID | OAuth2 Client ID for Google Drive API integration |
| Google Drive Client Secret | OAuth2 Client Secret for Google Drive API integration |
| Google Drive Poll Interval | How often to check for changes (30s / 60s / 120s) |

### Drag & Drop

Drag and drop handwriting files (.note) into the file explorer to create converted files at the drop location.

- Only supported extensions are processed; others fall through to Obsidian's default behavior
- If multiple parsers match the same extension, a selection modal is shown
- "Apply to all" option to batch-apply the same parser to files with the same extension
- Drop-converted files are protected from auto-deletion

### Google Drive

There are two ways to integrate Google Drive handwriting files:

#### Option 1: Google Drive for Desktop (local sync)

If you use Google Drive for Desktop to sync your handwriting files locally, you can point a Watch Directory at the synced folder for automatic conversion.

1. Install [Google Drive for Desktop](https://www.google.com/drive/download/)
2. Set up local sync for the Google Drive folder containing your handwriting files
3. Set the synced local path as a Watch Directory in Petrify settings
   - macOS: `~/Library/CloudStorage/GoogleDrive-<account>/My Drive/<folder>`
   - Windows: `G:\My Drive\<folder>` (drive letter may vary)

#### Option 2: Google Drive API (when virtual drive mounting is not available)

If virtual drive mounting is blocked (e.g. corporate policy), the Google Drive API adapter detects changes and downloads files directly via API.

1. Create an OAuth 2.0 Client ID (Desktop app type) in [Google Cloud Console](https://console.cloud.google.com/)
2. Enter Client ID / Client Secret in Petrify settings > Google Drive Settings
3. Set Source Type to "Google Drive" when adding a Watch Mapping
4. Enter the Google Drive folder ID as the Watch Directory (the string after `folders/` in the URL)
5. Complete OAuth authentication via the "Authenticate" button

**Key features:**
- Polling via Google Drive Changes API (configurable: 30s / 60s / 120s)
- Direct binary download via API — no local file sync required
- Automatic session restore via OAuth refresh token

### Requirements

- Obsidian 1.11.0+
- Desktop only (requires Node.js filesystem access)

## License

MIT

## Contributing

For development setup, architecture, and package structure, see [CONTRIBUTING.md](./CONTRIBUTING.md).
