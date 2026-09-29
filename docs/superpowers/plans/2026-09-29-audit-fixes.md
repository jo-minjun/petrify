# Audit fixes implementation plan

> **For agentic workers:** Use subagent-driven-development with regression tests and final integration review.

**Goal:** Fix the twelve audit findings selected by the user, preserving existing output on failures.

**Architecture:** Keep adapter dependencies outside core. Resolve persisted conversion state by explicit output path. Reuse generator incrementalUpdate for OCR preservation. Treat source deletion as a confirmed condition, not any read failure.

**Tech Stack:** TypeScript, Vitest, pnpm 10, Biome, Obsidian, PDF.js, Google Drive.

## Shared contracts

- `PetrifyService.handleFileChange(event, parser, outputPath = event.id)` accepts the persisted output location. All production callers supply it.
- `ConversionMetadataPort.getContent?(id)` returns existing generated content or undefined. When content cannot be recovered, regenerate all OCR rather than silently dropping unchanged text.
- `FrontmatterMetadataAdapter` reads vault output paths directly. The plugin removes its transient source-to-output lookup.
- Sync Drive source IDs use `gdrive://` consistently; filesystem read/access operations retain raw Drive IDs.

## Tasks

- [x] Core: reproduce unchanged OCR loss and parser changes skipped by equal input hashes; connect incrementalUpdate and correct hash guard. Preserve OCR through append/edit/removal and fall back safely without existing content.
- [x] Save: reproduce asset-write failure followed by skipped retry; write assets before committing body and metadata.
- [x] Parsers: reproduce unsupported/corrupt visible Supernote layers and FLATE pixel displacement; fail required decoding and implement rotation/padding crop with asymmetric fixtures.
- [x] Output: reproduce mixed-height Excalidraw overlap and Vision paragraph/line-break flattening; accumulate page positions and honor text break semantics.
- [x] Paths: reproduce hostile PAGEID traversal through Markdown and vault writer; encode asset names and enforce single-file asset names before any writes.
- [x] Drive: reproduce failed bootstrap and missing cached deletion events after restart; only persist bootstrap completion after success and restore deletion identity.
- [x] Plugin integration: pass output paths from watcher/manual conversion, preserve protected Drive output across restart, and look up deletion metadata directly. Validate deletion source identity and extension.
- [x] Orphan cleanup: do not delete after failed source enumeration or transient access failures; distinguish confirmed missing source and mapping ownership.
- [x] Regression verification: run relevant tests red before fixes, then all tests, typecheck, Biome, and production build. Review scope compliance and code quality per task, then final quality/security/business/data-integrity review.

## Verification commands

Use `npx --yes pnpm@10 exec vitest run <test paths>` for targeted regressions, then `npx --yes pnpm@10 check`, `npx --yes pnpm@10 typecheck`, `npx --yes pnpm@10 exec vitest run`, and `npx --yes pnpm@10 build`.

No dependency upgrades, release, or external issue/PR changes are part of this task. Drive failed-conversion retries are not a separate requested change; avoid widening scope beyond what is required to make bootstrap and deletion safe.
