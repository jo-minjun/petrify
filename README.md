# Petrify

Convert handwritten note app files to Obsidian Excalidraw.

## Introduction

Petrify lets you manage files from various handwriting note apps in a single format (Excalidraw) within Obsidian.

**Currently supported:**
- Parser: viwoods (.note)
- OCR: Tesseract.js, Google Cloud Vision
- Generator: Excalidraw, Markdown
- Watcher: chokidar (local filesystem)
- Obsidian plugin (watch external folders → auto-convert)

**Planned:**
- Watch files inside Obsidian Vault (VaultWatcher)

Parsers, OCR engines, Generators, and Watchers can be extended independently via the port/adapter pattern. OCR extracts handwritten text so your notes become searchable in Obsidian.

## Obsidian Plugin

Watches handwritten note files in external folders and automatically converts them to Excalidraw format in your Obsidian vault.

### Features

- **File watching**: Real-time file change detection via WatcherPort (currently chokidar adapter)
- **Multi-folder mapping**: Map multiple external folders to different vault folders
- **Auto-conversion**: PetrifyService handles extension filtering → mtime skip → conversion automatically
- **Drag & drop**: Drop handwriting files into the file explorer for instant conversion at that location
- **OCR support**: Handwritten text extraction (Tesseract.js / Google Cloud Vision)
- **Duplicate prevention**: Skips already-converted files by comparing mtime via ConversionMetadataPort
- **Source delete sync**: Optionally remove converted files when the source file is deleted

### Settings

| Setting | Description |
|---------|-------------|
| Output Format | Output file format (Excalidraw / Markdown) |
| Watch Directories | External folder paths to watch (multiple supported) |
| Output Directories | Vault paths for converted files (per mapping) |
| Parser | Parser to use for each watch folder (e.g. viwoods) |
| OCR Provider | OCR engine (Tesseract / Google Vision) |
| Confidence Threshold | OCR confidence threshold (0-100) |
| Delete on source delete | Delete converted file when source is deleted (default: off) |

### Drag & Drop

Drag and drop handwriting files (.note, etc.) into the file explorer to create `.excalidraw.md` files at the drop location.

- Only supported extensions are processed; others fall through to Obsidian's default behavior
- If multiple parsers match the same extension, a selection modal is shown
- "Apply to all" option to batch-apply the same parser to files with the same extension
- Drop-converted files get `keep: true` frontmatter to prevent auto-deletion

### Google Drive Integration

Point a Watch Directory at a locally synced Google Drive for Desktop folder for automatic conversion.

1. Install [Google Drive for Desktop](https://www.google.com/drive/download/)
2. Set up local sync for the Google Drive folder containing your handwriting files
3. Set the synced local path as a Watch Directory in Petrify settings
   - macOS: `~/Library/CloudStorage/GoogleDrive-<account>/My Drive/<folder>`
   - Windows: `G:\My Drive\<folder>` (drive letter may vary)

### Requirements

- Obsidian 1.11.0+
- Desktop only (requires Node.js filesystem access)

## License

MIT

## Contributing

For development setup, architecture, and package structure, see [CONTRIBUTING.md](./CONTRIBUTING.md).
