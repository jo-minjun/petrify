# Commit convention

Write commit messages in English using `<type>: <subject>`.

Allowed types: `feat`, `fix`, `refactor`, `docs`, `test`, `chore`.

Example: `fix: prevent conversion data loss and synchronization gaps`

Commit only after tests pass and compilation succeeds. Run `pnpm biome check`
before committing. Update `CHANGELOG.md` under `[Unreleased]` for user-facing
changes. Never commit credentials or other sensitive files.
