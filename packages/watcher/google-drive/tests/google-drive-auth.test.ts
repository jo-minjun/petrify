import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GoogleDriveAuth } from '../src/google-drive-auth.js';
import type { OAuthTokens, TokenStore } from '../src/types.js';

const mockSetCredentials = vi.fn();
const mockGenerateAuthUrl = vi
  .fn()
  .mockReturnValue('https://accounts.google.com/o/oauth2?scope=drive.readonly');
const mockOn = vi.fn();

vi.mock('google-auth-library', () => ({
  OAuth2Client: vi.fn(() => ({
    setCredentials: mockSetCredentials,
    generateAuthUrl: mockGenerateAuthUrl,
    on: mockOn,
  })),
}));

function createInMemoryTokenStore(): TokenStore & { tokens: OAuthTokens | null } {
  return {
    tokens: null,
    async loadTokens() {
      return this.tokens;
    },
    async saveTokens(t) {
      this.tokens = t;
    },
    async clearTokens() {
      this.tokens = null;
    },
  };
}

describe('GoogleDriveAuth', () => {
  let tokenStore: ReturnType<typeof createInMemoryTokenStore>;
  let auth: GoogleDriveAuth;

  beforeEach(() => {
    tokenStore = createInMemoryTokenStore();
    auth = new GoogleDriveAuth({
      clientId: 'test-client-id',
      clientSecret: 'test-client-secret',
      tokenStore,
    });
  });

  it('restoreSession returns null when no saved token exists', async () => {
    const client = await auth.restoreSession();
    expect(client).toBeNull();
  });

  it('restoreSession returns an OAuth2Client when a saved refresh token exists', async () => {
    tokenStore.tokens = {
      access_token: 'test-access',
      refresh_token: 'test-refresh',
      expiry_date: Date.now() + 3600_000,
    };

    const client = await auth.restoreSession();
    expect(client).not.toBeNull();
  });

  it('isAuthenticated returns false in initial state', () => {
    expect(auth.isAuthenticated()).toBe(false);
  });

  it('isAuthenticated returns true after successful restoreSession', async () => {
    tokenStore.tokens = {
      access_token: 'test-access',
      refresh_token: 'test-refresh',
      expiry_date: Date.now() + 3600_000,
    };

    await auth.restoreSession();
    expect(auth.isAuthenticated()).toBe(true);
  });

  it('revokeToken clears the token store and resets authentication state', async () => {
    tokenStore.tokens = {
      access_token: 'test',
      refresh_token: 'test',
      expiry_date: Date.now(),
    };

    await auth.restoreSession();
    expect(auth.isAuthenticated()).toBe(true);

    await auth.revokeToken();
    expect(tokenStore.tokens).toBeNull();
    expect(auth.isAuthenticated()).toBe(false);
  });

  it('getAuthUrl returns a Google OAuth2 authentication URL', () => {
    const url = auth.getAuthUrl();
    expect(url).toContain('accounts.google.com');
    expect(url).toContain('drive.readonly');
  });
});
