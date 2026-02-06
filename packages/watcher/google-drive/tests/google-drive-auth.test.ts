import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GoogleDriveAuth } from '../src/google-drive-auth.js';
import type { OAuthTokens, TokenStore } from '../src/types.js';

const mockSetCredentials = vi.fn();
const mockGenerateAuthUrl = vi.fn().mockReturnValue('https://accounts.google.com/o/oauth2?scope=drive.readonly');
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

  it('저장된 토큰이 없으면 restoreSession은 null을 반환한다', async () => {
    const client = await auth.restoreSession();
    expect(client).toBeNull();
  });

  it('저장된 refresh token이 있으면 restoreSession은 OAuth2Client를 반환한다', async () => {
    tokenStore.tokens = {
      access_token: 'test-access',
      refresh_token: 'test-refresh',
      expiry_date: Date.now() + 3600_000,
    };

    const client = await auth.restoreSession();
    expect(client).not.toBeNull();
  });

  it('초기 상태에서 isAuthenticated는 false를 반환한다', () => {
    expect(auth.isAuthenticated()).toBe(false);
  });

  it('restoreSession 성공 후 isAuthenticated는 true를 반환한다', async () => {
    tokenStore.tokens = {
      access_token: 'test-access',
      refresh_token: 'test-refresh',
      expiry_date: Date.now() + 3600_000,
    };

    await auth.restoreSession();
    expect(auth.isAuthenticated()).toBe(true);
  });

  it('revokeToken은 토큰 저장소를 클리어하고 인증 상태를 해제한다', async () => {
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

  it('getAuthUrl은 Google OAuth2 인증 URL을 반환한다', () => {
    const url = auth.getAuthUrl();
    expect(url).toContain('accounts.google.com');
    expect(url).toContain('drive.readonly');
  });
});
