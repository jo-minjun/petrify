# Contributing

## Development Environment

### Prerequisites

- Node.js 20+
- pnpm 10+

### Setup

```bash
pnpm install
pnpm typecheck
pnpm test
pnpm build
```

CI runs in this order: `typecheck → test → build`. Make sure all three pass before committing.

## Architecture

This project follows a **hexagonal architecture** (ports & adapters).

- **Core** (`@petrify/core`): Domain models (Note, Page), PetrifyService, and port interfaces
- **Ports**: Interfaces that define external dependencies
- **Adapters**: Concrete implementations of port interfaces (one per package)

### Dependency Direction

```
Adapters → Core ← Adapters
```

- Adapters depend on core
- Core does not know about adapters
- Core only defines port interfaces; adapters implement them
- `obsidian-plugin` is the sole **composition root** — all adapter wiring happens there

### Port Adapters

| Port | Adapter | Package |
|------|---------|---------|
| ParserPort | Viwoods (.note) | @petrify/parser-viwoods |
| OcrPort | Tesseract.js | @petrify/ocr-tesseract |
| OcrPort | Google Cloud Vision | @petrify/ocr-google-vision |
| FileGeneratorPort | Excalidraw (.excalidraw.md) | @petrify/generator-excalidraw |
| FileGeneratorPort | Markdown (.md) | @petrify/generator-markdown |
| WatcherPort | chokidar (local FS) | @petrify/watcher-chokidar |
| WatcherPort | Google Drive API | @petrify/watcher-google-drive |
| ConversionMetadataPort | Frontmatter-based | @petrify/obsidian-plugin |

### Data Flow

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                               @petrify/core                                  │
│                                                                              │
│  ┌──────────┐ ┌────────┐ ┌─────────────┐ ┌────────────────┐               │
│  │ParserPort│ │OcrPort │ │FileGenerator│ │Conversion      │               │
│  │          │ │        │ │    Port     │ │ MetadataPort   │               │
│  └────┬─────┘ └───┬────┘ └──────┬──────┘ └───────┬────────┘               │
│       │           │             │                │                        │
│       ▼           ▼             ▼                ▼                        │
│  ┌──────────────────────────────────────────────────────────────────┐     │
│  │                        PetrifyService                            │     │
│  │       filter ext → check mtime → parse → ocr → generate         │     │
│  └──────────────────────────────┬───────────────────────────────────┘     │
└─────────────────────────────────┼────────────────────────────────────────┘
                                  │ ConversionResult
                                  ▼
                   ┌───────────────────────────────┐
                   │     obsidian-plugin (save)     │
                   │  .excalidraw.md  |  .md       │
                   │       (Obsidian Vault)        │
                   └───────────────────────────────┘
```

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
│   ├── chokidar/         # @petrify/watcher-chokidar (WatcherPort impl)
│   └── google-drive/     # @petrify/watcher-google-drive (WatcherPort impl)
└── obsidian-plugin/      # Obsidian plugin (composition root + UI)
```

Shared devDependencies (`typescript`, `vitest`, `tsup`) live in the root `package.json` only. Do not add them to individual packages.

## Code Conventions

- **ESM only** — no `require()` or `module.exports`
- **Import paths** must include `.js` extension: `import { Note } from './models/index.js'`
- **Type imports** use `import type`: `import type { ParserPort } from './ports/parser.js'`
- **Immutable fields** use `readonly`: `private readonly parser = new NoteParser()`
- **Async** uses `async`/`await`, not raw Promises
- **Errors** use explicit exception classes: `throw new ParseError('...')`
- **Public API** is exported from each package's `index.ts`
- **Shared types** are defined in `@petrify/core` only — adapters import them

## Testing

- Run tests: `pnpm test`
- Test files: `**/tests/**/*.test.ts`
- Import `describe`, `it`, `expect` explicitly from `vitest` (no `globals: true`)
- Test **behavior** through public APIs, not internal structure
- Do not use `as any` to access private members
- Integration tests live in the `obsidian-plugin` package

## Adding a New Adapter

1. Implement the port interface
2. Export public API from `index.ts`
3. Verify the package matches a pattern in `pnpm-workspace.yaml`
4. Add path alias to root `tsconfig.base.json` `paths`
5. Add alias to root `vitest.config.ts`
6. Register the adapter in `obsidian-plugin` (the composition root)
7. Update this document and `CLAUDE.md`
