import { OAuth2Client } from 'google-auth-library';
import type { GoogleDriveAuthOptions, TokenStore } from './types.js';

const SCOPES = ['https://www.googleapis.com/auth/drive.readonly'];
const REDIRECT_URI = 'http://localhost';

export class GoogleDriveAuth {
  private readonly clientId: string;
  private readonly clientSecret: string;
  private readonly tokenStore: TokenStore;
  private client: OAuth2Client | null = null;

  constructor(options: GoogleDriveAuthOptions) {
    this.clientId = options.clientId;
    this.clientSecret = options.clientSecret;
    this.tokenStore = options.tokenStore;
  }

  async restoreSession(): Promise<OAuth2Client | null> {
    const tokens = await this.tokenStore.loadTokens();
    if (!tokens?.refresh_token) return null;

    const client = new OAuth2Client(this.clientId, this.clientSecret, REDIRECT_URI);
    client.setCredentials({
      refresh_token: tokens.refresh_token,
      access_token: tokens.access_token,
      expiry_date: tokens.expiry_date,
    });

    client.on('tokens', async (newTokens) => {
      await this.tokenStore.saveTokens({
        access_token: newTokens.access_token ?? tokens.access_token,
        refresh_token: newTokens.refresh_token ?? tokens.refresh_token,
        expiry_date: newTokens.expiry_date ?? tokens.expiry_date,
      });
    });

    this.client = client;
    return client;
  }

  getAuthUrl(): string {
    const client = new OAuth2Client(this.clientId, this.clientSecret, REDIRECT_URI);
    return client.generateAuthUrl({
      access_type: 'offline',
      scope: SCOPES,
      prompt: 'consent',
    });
  }

  async handleAuthCode(code: string): Promise<OAuth2Client> {
    const client = new OAuth2Client(this.clientId, this.clientSecret, REDIRECT_URI);
    const { tokens } = await client.getToken(code);

    await this.tokenStore.saveTokens({
      access_token: tokens.access_token ?? '',
      refresh_token: tokens.refresh_token ?? '',
      expiry_date: tokens.expiry_date ?? 0,
    });

    client.setCredentials(tokens);
    this.client = client;
    return client;
  }

  isAuthenticated(): boolean {
    return this.client !== null;
  }

  async revokeToken(): Promise<void> {
    this.client = null;
    await this.tokenStore.clearTokens();
  }
}
