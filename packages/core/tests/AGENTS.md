# AGENTS.md

## Test Framework

- Uses **Vitest**
- Test files: `*.test.ts`

## Commands

```bash
# Run all tests
pnpm test

# Run tests for a specific package
pnpm --filter @petrify/core test

# Watch mode
pnpm test -- --watch
```

## Test Types

### Unit Tests
- Verify each adapter's public API methods
- Must include error cases (success + error pairs)
- Use mocks only for external dependencies (file system, OCR API)

### Integration Tests
- At the PetrifyService entry point level (handleFileChange, convertDroppedFile, handleFileDelete)
- Use lightweight fakes (in-memory implementations); avoid vi.mock
- Verify the full pipeline flow (parse -> OCR -> generate -> save)

## DO

- Write tests when adding new features
- Place test files in the `tests/` directory
  ```
  packages/core/
  ├── src/
  │   └── models/
  │       └── note.ts
  └── tests/
      └── models/
          └── note.test.ts
  ```

## DON'T

- Do not disable tests (do not leave skip or only)
- Do not write meaningless assertions like `expect(true).toBe(true)`
- Do not spy on internal implementation details
