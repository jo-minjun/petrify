---
name: align-readme
description: >
  Audit README.md and CONTRIBUTING.md against the actual codebase to find and fix documentation drift.
  Use when: (1) packages are added or removed, (2) plugin settings or features change,
  (3) port interfaces or adapters are modified, (4) after any structural change that may
  make README.md or CONTRIBUTING.md outdated. Manually triggered via /align-readme.
---

# Align README

Scan the codebase and interactively synchronize README.md and CONTRIBUTING.md with code reality.

**Code is the source of truth.** AGENTS.md is read-only reference (use `align-architecture` to audit code against AGENTS.md — this skill does the reverse).

## Process

### 1. Scan Codebase

Collect current state from code:

**Packages** — Read `pnpm-workspace.yaml` to get package globs, then find all matching `package.json` files. Extract each `name` field. Build the directory tree.

**Ports & Adapters** — Read `packages/core/src/ports/*.ts` for port interface names. Search adapter `src/` dirs for `implements <PortName>` to build the mapping. Note supported file extensions per adapter.

**Plugin Settings** — Read `packages/obsidian-plugin/src/settings-tab.ts`. Extract setting names and descriptions from the UI registration code.

**Plugin Features** — Read `packages/obsidian-plugin/src/main.ts` and related files. Identify registered commands, event handlers, and capabilities.

### 2. Parse Documents

Read README.md and CONTRIBUTING.md. Split into auditable sections:

**README.md:**
- Supported list (Parser, OCR, Output, Watcher)
- Planned items
- Features list
- Settings table
- Requirements

**CONTRIBUTING.md:**
- Package structure tree
- Port-Adapter mapping table
- Data flow diagram
- New adapter checklist

### 3. Compare & Update (Section by Section)

Process each section in order (README first, then CONTRIBUTING):

1. Compare code-collected data against document content
2. If **matching** → report `PASS`, move on
3. If **discrepancy found**:
   - Show what the document says vs what the code shows
   - Propose specific edits
   - Ask user: approve / modify / skip
   - Apply on approval

Preserve existing document formatting and style. Change only what is necessary.

### 4. Report

After all sections are processed, print a summary:

```
## align-readme Results

| Document | Section | Status |
|----------|---------|--------|
| README.md | Supported list | PASS / UPDATED / SKIPPED |
| ... | ... | ... |

Checked: N sections | Passed: N | Updated: N | Skipped: N
```
