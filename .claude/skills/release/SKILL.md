---
name: release
description: >
  Automate the full Obsidian plugin release process: update CHANGELOG.md [Unreleased] section,
  bump version in manifest.json/package.json/versions.json, commit, create git tag, and push.
  Use when: (1) user says /release, (2) user wants to release a new version,
  (3) user wants to bump version and tag, (4) user mentions "release", "version bump", or "tag".
  Accepts optional version argument (e.g., /release 0.3.0) to override auto-detection.
---

# Release

Automate the full release pipeline for this Obsidian plugin project.

## Version Files

Three files track the plugin version:

| File | Field | Example |
|------|-------|---------|
| `packages/obsidian-plugin/manifest.json` | `"version"` | `"0.3.0"` |
| `packages/obsidian-plugin/package.json` | `"version"` | `"0.3.0"` |
| `packages/obsidian-plugin/versions.json` | `"0.3.0": "minAppVersion"` | `"0.3.0": "1.11.4"` |

`minAppVersion` is read from the current `manifest.json`.

## Process

### 1. Pre-flight Checks

Verify before proceeding:
- Working tree is clean (`git status --porcelain` returns empty)
- On `main` branch
- CHANGELOG.md `[Unreleased]` section has content (not empty)

If any check fails, report and stop.

### 2. Determine Version

Read current version from `packages/obsidian-plugin/manifest.json`.

**If user provided a version argument:** use it directly.

**If no argument:** infer from CHANGELOG.md `[Unreleased]` categories:
- `### Added` or `### Changed` present → **minor** bump
- Only `### Fixed` present → **patch** bump
- Present the inferred version and ask user to confirm or override

### 3. Update CHANGELOG.md

1. Replace `## [Unreleased]` with `## [x.y.z] - YYYY-MM-DD` (today's date)
2. Add new empty `## [Unreleased]` section above it
3. Update bottom reference links:
   - Change `[Unreleased]` link to compare from new version tag
   - Add `[x.y.z]` compare link between previous version and new version

### 4. Update Version Files

1. `packages/obsidian-plugin/manifest.json` → set `"version": "x.y.z"`
2. `packages/obsidian-plugin/package.json` → set `"version": "x.y.z"`
3. `packages/obsidian-plugin/versions.json` → add `"x.y.z": "<minAppVersion>"`

### 5. Verify

Run: `pnpm check && pnpm typecheck && pnpm test && pnpm build`

If any step fails, stop and report.

### 6. Commit, Tag, Push

```
git add CHANGELOG.md packages/obsidian-plugin/manifest.json packages/obsidian-plugin/package.json packages/obsidian-plugin/versions.json
git commit -m "chore: release x.y.z"
git tag x.y.z
git push && git push origin x.y.z
```

The tag push triggers `.github/workflows/release.yml` which automatically builds and publishes the GitHub Release.
