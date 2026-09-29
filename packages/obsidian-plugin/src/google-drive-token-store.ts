import type { OAuthTokens, PageTokenStore, TokenStore } from '@petrify/watcher-google-drive';
import type { Plugin } from 'obsidian';
import { updatePluginData } from './plugin-data.js';

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
  const cacheKey = `fileCache_${folderId}`;
  return {
    loadPageToken: async () => {
      const data = await plugin.loadData();
      return data?.[key] ?? null;
    },
    savePageToken: (token) => updatePluginData(plugin, (data) => ({ ...data, [key]: token })),
    loadFileCache: async () => {
      const data = (await plugin.loadData()) ?? {};
      const raw: unknown = data[cacheKey];
      if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
      const cache: Record<string, { name: string; extension: string }> = {};
      for (const [id, entry] of Object.entries(raw)) {
        if (
          entry &&
          typeof entry === 'object' &&
          'name' in entry &&
          'extension' in entry &&
          typeof entry.name === 'string' &&
          typeof entry.extension === 'string'
        ) {
          Object.defineProperty(cache, id, {
            value: { name: entry.name, extension: entry.extension },
            enumerable: true,
          });
        }
      }
      return cache;
    },
    saveFileCache: (files) => updatePluginData(plugin, (data) => ({ ...data, [cacheKey]: files })),
  };
}
