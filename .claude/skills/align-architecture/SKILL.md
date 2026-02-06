---
name: align-architecture
description: Audit the codebase against AGENTS.md architecture rules, identify discrepancies, and fix them. Use when verifying hexagonal architecture compliance, code conventions, test quality, dependency direction, package configuration, or documentation sync after changes.
---

# Align Architecture

Audit the codebase against AGENTS.md and fix all discrepancies.

## Process

### 1. Load Rules

Read AGENTS.md (or CLAUDE.md) to extract the full rule set: architecture constraints, DO rules, and DON'T rules.

### 2. Audit

Use the Explore agent to check each category systematically. Report each rule as PASS or FAIL with file paths and line numbers.

**Architecture & Dependencies**
- Core defines ports; adapters implement them
- Core never imports from adapter packages
- All adapters depend on `@petrify/core`
- `obsidian-plugin` is the sole Composition Root

**Package Configuration**
- `pnpm-workspace.yaml` matches actual directories
- Root `tsconfig.json` paths include all workspace packages
- Root `vitest.config.ts` aliases include all workspace packages
- Common devDependencies (typescript, vitest, tsup) only in root `package.json`
- No unnecessary per-package `vitest.config.ts`
- No `package-lock.json`

**Code Conventions**
- `.js` extension on all imports
- `import type` for type-only imports
- No CommonJS (`require`, `module.exports`)
- No `any` type abuse
- `readonly` on immutable fields
- `async/await` (no raw Promise chains)
- Public APIs exported from `index.ts`

**Error Handling**
- Required data failures throw explicit exception classes
- Optional data failures return defaults + log
- No silent fail on required data

**Test Quality**
- No `globals: true` in vitest config
- Explicit vitest imports (`describe`, `it`, `expect`)
- No default constant tests (`id`, `displayName`, `extension` values)
- No interface shape tests
- No data model creation tests
- No `as any` for private member access
- No meaningless assertions (`expect(true).toBe(true)`)
- Behavior-focused tests through public API

**Documentation Sync**
- README.md package structure matches actual layout
- README.md port/adapter table matches all ports in core
- AGENTS.md package table matches actual packages

### 3. Plan Fixes

For each FAIL, create actionable fix items using TodoWrite.

### 4. Implement

- Remove violating tests entirely (no commenting out)
- Fix import patterns, configuration, or dependency violations
- Sync documentation with actual state
- Never introduce new violations while fixing

### 5. Verify

Run `pnpm test` and `pnpm build` (if available). All tests must pass.

### 6. Summary

Report: total rules checked, pass/fail counts, fixes applied, test results.
