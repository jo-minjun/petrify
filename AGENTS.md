# AGENTS.md

## Architecture

### Hexagonal Architecture

This project follows the hexagonal architecture pattern.

- **Core**: Core domain models (Note, Page), PetrifyService, and port interfaces
- **Ports**: Interface definitions for external dependencies (ParserPort, OcrPort, FileGeneratorPort, ConversionMetadataPort, WatcherPort)
- **Adapters**: Concrete implementations of port interfaces (ViwoodsParser, etc.)

### Dependency Direction

```
Adapters → Core ← Adapters
```

- Adapters depend on core
- Core does not know about adapters
- Core only defines port interfaces; adapters implement them

### Package Structure

```
packages/
├── core/                 # @petrify/core
├── parser/
│   └── viwoods/          # @petrify/parser-viwoods
├── ocr/
│   ├── tesseract/        # @petrify/ocr-tesseract
│   └── google-vision/    # @petrify/ocr-google-vision
├── generator/
│   ├── excalidraw/       # @petrify/generator-excalidraw
│   └── markdown/         # @petrify/generator-markdown
├── watcher/
│   ├── chokidar/         # @petrify/watcher-chokidar
│   └── google-drive/     # @petrify/watcher-google-drive
└── obsidian-plugin/      # @petrify/obsidian-plugin
```

| Package | Role |
|--------|------|
| `@petrify/core` | Intermediate representation models, PetrifyService, port interfaces |
| `@petrify/parser-viwoods` | viwoods .note file parser (ParserPort implementation) |
| `@petrify/ocr-tesseract` | Tesseract.js wrapper OCR (OcrPort implementation) |
| `@petrify/ocr-google-vision` | Google Cloud Vision OCR (OcrPort implementation) |
| `@petrify/generator-excalidraw` | Excalidraw file generation (FileGeneratorPort implementation) |
| `@petrify/generator-markdown` | Markdown file generation (FileGeneratorPort implementation) |
| `@petrify/watcher-chokidar` | chokidar wrapper file watcher (WatcherPort implementation) |
| `@petrify/watcher-google-drive` | Google Drive API change detection (WatcherPort implementation) |
| `@petrify/obsidian-plugin` | Composition Root: Obsidian plugin, adapter assembly |

## DO

- After modifying source files, apply formatting with `pnpm biome check --write`. Before committing, run `pnpm biome check` for final verification

- Commit only after tests pass

- Manage shared devDependencies (typescript, vitest, tsup) only in the root package.json
  ```json
  // Root package.json
  {
    "devDependencies": {
      "typescript": "^5.3.0",
      "vitest": "^2.0.0",
      "tsup": "^8.0.0"
    }
  }
  ```

- Manage vitest configuration in the root vitest.config.ts. Only add a per-package vitest.config.ts when package-specific settings are needed (e.g., external module aliases)

- Specify all workspace package paths in root tsconfig.json paths
  ```json
  {
    "paths": {
      "@petrify/core": ["packages/core/src/index.ts"],
      "@petrify/parser-viwoods": ["packages/parser/viwoods/src/index.ts"],
      "@petrify/ocr-tesseract": ["packages/ocr/tesseract/src/index.ts"],
      "@petrify/ocr-google-vision": ["packages/ocr/google-vision/src/index.ts"],
      "@petrify/generator-excalidraw": ["packages/generator/excalidraw/src/index.ts"],
      "@petrify/generator-markdown": ["packages/generator/markdown/src/index.ts"],
      "@petrify/watcher-chokidar": ["packages/watcher/chokidar/src/index.ts"],
      "@petrify/watcher-google-drive": ["packages/watcher/google-drive/src/index.ts"]
    }
  }
  ```

- Run integration tests at the plugin package (obsidian-plugin) level

- Handle errors with explicit exception classes
  ```typescript
  throw new InvalidFileFormatError('Invalid file format');
  throw new ParseError('Failed to parse stroke data');
  ```

- Explicitly export public API from index.ts
  ```typescript
  export { PetrifyService } from './petrify-service.js';
  export type { ParserPort } from './ports/parser.js';
  ```

- Include `.js` extension in import paths
  ```typescript
  import { Note } from './models/index.js';
  ```

- Use `import type` for types
  ```typescript
  import type { ParserPort } from './ports/parser.js';
  import { ExcalidrawGenerator } from './excalidraw/generator.js';
  ```

- Use readonly for immutable fields
  ```typescript
  readonly extensions = ['.note'];
  private readonly parser = new NoteParser();
  ```

- Use async/await pattern for Promises
  ```typescript
  async parse(data: ArrayBuffer): Promise<Note> {
    return this.parser.parse(data);
  }
  ```

- Throw explicit exceptions when required data parsing fails
  ```typescript
  throw new ParseError('Failed to parse stroke data');
  ```

- Return default values + log when optional data parsing fails
  ```typescript
  // Optional metadata - default behavior is possible without it
  } catch {
    return {};
  }
  ```

- Explicitly import describe, it, expect, etc. from vitest
  ```typescript
  import { describe, it, expect } from 'vitest';
  ```

- Test behavior, not structure
  ```typescript
  // DO: Verify output of public methods
  const result = generator.generate(note, 'test');
  expect(result.content).toContain('expected-text');

  // DON'T: Check object structure or types
  const note: Note = { title: 'Test', pages: [] };
  expect(note.title).toBe('Test');  // TypeScript already guarantees this
  ```

- Test through the public API; do not access private members
  ```typescript
  // DO: Call public generate() and verify the result
  const md = generator.generate(data, undefined, ocrResults);
  expect(md).toContain('## OCR Text');

  // DON'T: Directly call private methods
  const result = (generator as any).formatOcrSection(ocrResults);
  ```

- Define shared types/interfaces only in @petrify/core; adapter packages should import and use them

- Keep README.md and AGENTS.md in sync: update both when adding/removing packages or renaming classes

- Checklist when adding a new adapter package:
  1. Implement the port interface
  2. Export the public API from index.ts
  3. Verify pnpm-workspace.yaml patterns
  4. Add paths to root tsconfig.json
  5. Add aliases to root vitest.config.ts
  6. Update root AGENTS.md package structure/table

- Use CSS classes in `styles.css` instead of inline styles. Prefix all classes with `petrify-`

- obsidian-plugin is the sole Composition Root. Register new adapters only in this package

## DON'T

- Do not directly import specific adapters from core (dependency inversion violation)
- Do not add implementations that bypass port interfaces
- Do not commit with compilation errors
- Do not leave unused imports/variables
- Do not use CommonJS syntax (require, module.exports)
- Do not overuse the any type
- Do not silently fail on required data errors
- Do not use vitest globals: true
- Do not add shared devDependencies (typescript, vitest, tsup) in individual packages
- Do not unnecessarily create vitest.config.ts in individual packages (when root configuration suffices)
- Do not leave package-lock.json when using pnpm
- Do not add adapter dependencies in the core package (including devDependencies)
- Do not access private members with `as any` in tests
- Do not test data model (interface) creation -- the TypeScript type system guarantees this
- Do not test configuration defaults (default constants)
- Do not test interface contracts (shape) -- the TypeScript compiler guarantees this
- Do not write meaningless assertions like `expect(true).toBe(true)`
- Do not redefine types in adapter packages that are already defined in core
- Do not use `console.log` in runtime source (`src/`) — use `console.debug`, `console.warn`, or `console.error` instead (Obsidian community plugin guideline)
- Do not use inline styles (`.style.` assignment) in TypeScript — use CSS classes instead (Obsidian community plugin guideline)
