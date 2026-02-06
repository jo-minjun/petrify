# Contributing

## Development Environment

### Prerequisites

- Node.js 20+
- pnpm

### Setup

```bash
pnpm install
pnpm build
pnpm test
```

### Installing Individual Packages

```bash
pnpm add @petrify/core
pnpm add @petrify/parser-viwoods
pnpm add @petrify/ocr-tesseract
pnpm add @petrify/watcher-chokidar
```

## Architecture

```
┌──────────────────────────────────────────────────────────────────────────┐
│                             @petrify/core                                │
│                                                                          │
│  ┌──────────┐ ┌─────────┐ ┌───────────┐ ┌─────────────┐ ┌─────────────┐  │
│  │ParserPort│ │ OcrPort │ │WatcherPort│ │FileGenerator│ │Conversion   │  │
│  │          │ │         │ │           │ │    Port     │ │MetadataPort │  │
│  └────┬─────┘ └────┬────┘ └─────┬─────┘ └──────┬──────┘ └──────┬──────┘  │
│       │            │            │              │               │         │
│       ▼            ▼            ▼              ▼               ▼         │
│  ┌────────────────────────────────────────────────────────────────────┐  │
│  │                        PetrifyService                              │  │
│  │        filter ext -> check mtime -> parse -> ocr -> generate       │  │
│  └──────────────────────────────┬─────────────────────────────────────┘  │
└─────────────────────────────────┼────────────────────────────────────────┘
                                  │
                                  ▼
                  ┌───────────────────────────────┐
                  │  .excalidraw.md  |  .md       │
                  │       (Obsidian Vault)        │
                  └───────────────────────────────┘
```

### Port Adapters

| Port | Adapter | Package |
|------|---------|---------|
| ParserPort | viwoods (.note) | @petrify/parser-viwoods |
| OcrPort | Tesseract.js | @petrify/ocr-tesseract |
| OcrPort | Google Cloud Vision | @petrify/ocr-google-vision |
| FileGeneratorPort | Excalidraw (.excalidraw.md) | @petrify/generator-excalidraw |
| FileGeneratorPort | Markdown (.md) | @petrify/generator-markdown |
| WatcherPort | chokidar (local FS) | @petrify/watcher-chokidar |
| ConversionMetadataPort | Frontmatter-based | @petrify/obsidian-plugin |

## Package Structure

```
packages/
├── core/                 # @petrify/core (port interfaces + PetrifyService)
├── parser/
│   └── viwoods/          # @petrify/parser-viwoods (ParserPort impl)
├── ocr/
│   ├── tesseract/        # @petrify/ocr-tesseract (OcrPort impl)
│   └── google-vision/    # @petrify/ocr-google-vision (OcrPort impl)
├── generator/
│   ├── excalidraw/       # @petrify/generator-excalidraw (FileGeneratorPort impl)
│   └── markdown/         # @petrify/generator-markdown (FileGeneratorPort impl)
├── watcher/
│   └── chokidar/         # @petrify/watcher-chokidar (WatcherPort impl)
└── obsidian-plugin/      # Obsidian plugin (composition root + UI)
```
