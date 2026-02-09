import type { OAuthTokens, PageTokenStore, TokenStore } from '@petrify/watcher-google-drive';
import type { Plugin } from 'obsidian';

const SECRET_ID = 'petrify-drive-tokens';

export function createTokenStore(plugin: Plugin): TokenStore {
  return {
    loadTokens: () => {
      const raw = plugin.app.secretStorage.getSecret(SECRET_ID);
      if (!raw) return Promise.resolve(null);

      try {
        const tokens: unknown = JSON.parse(raw);
        if (
          tokens !== null &&
          typeof tokens === 'object' &&
          'refresh_token' in tokens &&
          typeof (tokens as Record<string, unknown>).refresh_token === 'string'
        ) {
          return Promise.resolve(tokens as OAuthTokens);
        }
        return Promise.resolve(null);
      } catch {
        return Promise.resolve(null);
      }
    },
    saveTokens: (tokens) => {
      plugin.app.secretStorage.setSecret(SECRET_ID, JSON.stringify(tokens));
      return Promise.resolve();
    },
    clearTokens: () => {
      plugin.app.secretStorage.setSecret(SECRET_ID, '');
      return Promise.resolve();
    },
  };
}

export function hasTokens(plugin: Plugin): Promise<boolean> {
  const raw = plugin.app.secretStorage.getSecret(SECRET_ID);
  return Promise.resolve(!!raw);
}

export function createPageTokenStore(plugin: Plugin, folderId: string): PageTokenStore {
  const key = `pageToken_${folderId}`;
  return {
    loadPageToken: async () => {
      const data = await plugin.loadData();
      return data?.[key] ?? null;
    },
    savePageToken: async (token) => {
      const data = (await plugin.loadData()) ?? {};
      data[key] = token;
      await plugin.saveData(data);
    },
  };
}
