# Obsidian Plugin Guidelines

Rules derived from Obsidian community plugin review requirements.

## DO

- Use sentence case for UI text (capitalize first word + proper nouns/acronyms only)
  ```typescript
  // DO
  'Select Google Drive folder'
  'Enter client ID'
  'Tesseract (local)'

  // DON'T
  'Select Google Drive Folder'
  'Enter Client ID'
  'Tesseract (Local)'
  ```

- Use `this.app.vault.configDir` instead of hardcoding `.obsidian`
  ```typescript
  const pluginDir = path.join(vaultPath, this.app.vault.configDir, 'plugins', 'petrify');
  ```

- Use `this.app.fileManager.trashFile()` instead of `vault.trash()`

- Use bare command IDs — Obsidian auto-prefixes the plugin ID
  ```typescript
  // DO
  id: 'sync',
  // DON'T
  id: 'petrify-sync',
  ```

- Use Obsidian `requestUrl` for HTTP requests; for adapter packages, inject HTTP functions
  ```typescript
  httpPost: async (url, { body, headers }) => {
    const res = await requestUrl({ url, method: 'POST', headers, body, throw: false });
    return { status: res.status, body: res.text };
  },
  ```

- Define minimal interfaces for untyped APIs instead of using `any`

## DON'T

- Do not return `Promise` from `void`-returning lifecycle methods (`onunload`, etc.)
- Do not use "General" as a settings heading — use descriptive names
- Do not use `fetch()` directly — use `requestUrl`
