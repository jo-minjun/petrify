# Review follow-up implementation plan

**Goal:** Preserve heading-like OCR during incremental updates and prevent cross-folder Drive deletion.

**Approved design:** Persist the producing source folder for new Drive conversions; preserve legacy output without known ownership. Retain deletion synchronization only when source and folder ownership are known. Do not automatically infer ownership for legacy output from a 404 or a shared output directory.

**Architecture:** Add optional `sourceFolder` to core conversion metadata and change/delete events. Drive events use canonical `gdrive://<folderId>` values; local events omit the field. Store the optional value in existing frontmatter, keeping legacy files readable. Both manual orphan cleanup and automatic deletion require matching ownership for Drive. The equal-content skip remains unchanged, so legacy output is not rewritten solely to add ownership.

**Tech stack:** TypeScript, Vitest, pnpm 10, Obsidian.

## Tasks

- [x] OCR: reproduce heading-like text loss via real PetrifyService and Excalidraw generator; correct section extraction in `packages/generator/excalidraw/src/ocr-extractor.ts`; cover section-title-like OCR and unchanged later pages. Keep integration tests in the plugin package.
- [x] Drive red tests: extend sync-orchestrator, frontmatter metadata, watcher and plugin lifecycle tests for same-folder deletion, cross-folder/unknown-folder preservation, and persisted ownership on new conversions.
- [x] Drive implementation: extend core ports/service, Google Drive watcher, plugin sync events, frontmatter serialization/adapter, and main deletion guard. Require exact nonempty folder match in addition to current source/parser/keep checks.
- [x] Verify each regression fails before implementation and passes afterward. Run full Vitest, typecheck, Biome and production build with `npx --yes pnpm@10`.
- [x] Update CHANGELOG, independently review changed caller flows, and report results. PR updates require a verified commit; do not force-push existing history.

## Deletion examples

- A and B share an output directory; B disabled; B-owned source returns 404 during A sync: preserve B output and assets.
- A-owned source returns 404 during A sync: delete only unprotected output and its assets.
- Legacy source without sourceFolder: preserve on manual and automatic Drive deletion.
- Local deletion semantics remain unchanged.
