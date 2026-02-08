# Petrify Code Review Style Guide

The coding rules for this project are defined in `AGENTS.md` files located throughout the repository.
Find all `AGENTS.md` files from the directory of the file under review up to the root, and review based on the DO/DON'T rules.

- The root `AGENTS.md` contains common rules that apply to the entire project.
- `AGENTS.md` files in subdirectories contain rules specific to that package/directory.
- Subdirectory rules are more specific and take precedence, but should be reviewed alongside root rules.

## Review Focus Areas

When reviewing code changes, focus on the following:

### 1. Hexagonal Architecture Dependency Direction Violations
- Check if the core package directly imports adapter packages
- Check for implementations that bypass port interfaces

### 2. Error Handling
- Check if required data failures are handled with silent fails
- Check if appropriate exception classes are used

### 3. Monorepo Package Boundaries
- Check if shared devDependencies are duplicated in individual packages
- Check if shared types are redefined in adapter packages

### 4. Test Quality
- Check if tests verify behavior, not structure
- Check if tests go through the public API

## What Not to Review

- **Code formatting**: Automatically managed by biome.json.
- **Simple type safety**: Guaranteed by the TypeScript compiler.
- **Items verified by CI**: Build, typecheck, and lint are automatically verified in the CI pipeline.
