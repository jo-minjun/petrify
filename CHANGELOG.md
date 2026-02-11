# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Changed

- Refactored entire codebase for Obsidian guideline compliance (#41)
- Clarified Excalidraw output format description

### Fixed

- Added homepage, repository, and bugs metadata to plugin package.json

## [0.2.2] - 2026-02-08

### Changed

- Switched `require('electron')` to `await import('electron')` for ESM compliance
- Replaced direct `fetch()` usage with `httpPost` (required parameter)
- Applied sentence case to all UI text
- Translated Gemini styleguide to English

### Fixed

- Restored proper noun capitalization (Google, Tesseract, Vision)
- Restored onunload resource cleanup ordering
- Resolved AGENTS.md symlink structure issue

## [0.2.1] - 2026-02-08

### Changed

- Improved plugin guideline compliance

## [0.2.0] - 2026-02-08

### Added

- README screenshots and drag-and-drop GIF
- "Why Petrify" section in README
- Project vision document

### Changed

- Upgraded minimum Obsidian version to 1.11.4
- Translated codebase (test cases, comments, AGENTS.md) to English
- Completed Obsidian community plugin submission checklist

### Fixed

- Security audit: SecretStorage token/key protection and Drive ID query injection prevention (#37)
- OCR provider not reinitializing on settings change

## [0.1.2] - 2026-02-08

### Fixed

- Blob URL Worker blocked by `file://` protocol (#33)

## [0.1.1] - 2026-02-08

### Fixed

- Missing tesseract-core relaxedsimd-lstm variant (#32)

## [0.1.0] - 2026-02-08

### Added

- Core conversion pipeline: Viwoods .note → Excalidraw (.excalidraw.md) or Markdown
- Google Vision OCR support (#4)
- FileGeneratorPort for multiple output formats (#5)
- Biome code formatter/linter (#8)
- Keep property update protection with toggle UI (#17)
- Settings UI category-based redesign (#20)
- Local Watch directory browse button (#21)
- OS native folder browser dialog (#22)
- Google Drive OAuth authentication and API sync (#24)
- BRAT beta plugin release support (#29)

### Changed

- Reduced plugin size by 78% via Tesseract.js bundle separation (#15)
- SHA-1 hash-based fileId for Excalidraw generation (#18)
- Markdown output order: image first, then OCR text (#28)
- Removed autoSync settings toggle (#27)

### Fixed

- DropHandler stale reference bug (#30)

[Unreleased]: https://github.com/jo-minjun/petrify/compare/0.2.2...HEAD
[0.2.2]: https://github.com/jo-minjun/petrify/compare/0.2.1...0.2.2
[0.2.1]: https://github.com/jo-minjun/petrify/compare/0.2.0...0.2.1
[0.2.0]: https://github.com/jo-minjun/petrify/compare/0.1.2...0.2.0
[0.1.2]: https://github.com/jo-minjun/petrify/compare/0.1.1...0.1.2
[0.1.1]: https://github.com/jo-minjun/petrify/compare/0.1.0...0.1.1
[0.1.0]: https://github.com/jo-minjun/petrify/releases/tag/0.1.0
