---
name: align-architecture
description: Audit the codebase against AGENTS.md architecture rules, identify discrepancies, and fix them. Use when verifying hexagonal architecture compliance, code conventions, test quality, dependency direction, package configuration, or documentation sync after changes.
---

# Align Architecture

Audit the codebase against AGENTS.md and fix all discrepancies.

## Process

### 1. Load Rules

Read AGENTS.md (or CLAUDE.md) to extract the full rule set. Parse and categorize every rule into:
- Architecture constraints
- DO rules
- DON'T rules

### 2. Audit

For each extracted rule, use the Explore agent to verify compliance across the codebase. Report each rule as PASS or FAIL with specific file paths and line numbers.

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
