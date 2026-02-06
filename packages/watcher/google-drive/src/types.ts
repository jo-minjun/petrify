import type { OAuth2Client } from 'google-auth-library';

// --- OAuth2 인증 ---

export interface OAuthTokens {
  readonly access_token: string;
  readonly refresh_token: string;
  readonly expiry_date: number;
}

export interface TokenStore {
  loadTokens(): Promise<OAuthTokens | null>;
  saveTokens(tokens: OAuthTokens): Promise<void>;
  clearTokens(): Promise<void>;
}

export interface GoogleDriveAuthOptions {
  readonly clientId: string;
  readonly clientSecret: string;
  readonly tokenStore: TokenStore;
}

// --- Google Drive API ---

export interface DriveFile {
  readonly id: string;
  readonly name: string;
  readonly mimeType: string;
  readonly modifiedTime: string;
  readonly md5Checksum?: string;
  readonly size?: string;
  readonly parents?: string[];
}

export interface DriveChange {
  readonly fileId: string;
  readonly removed: boolean;
  readonly file?: DriveFile;
  readonly time: string;
}

export interface ChangesResult {
  readonly changes: DriveChange[];
  readonly newStartPageToken?: string;
  readonly nextPageToken?: string;
}

// --- Watcher ---

export interface PageTokenStore {
  loadPageToken(): Promise<string | null>;
  savePageToken(token: string): Promise<void>;
}

export interface GoogleDriveWatcherOptions {
  readonly folderId: string;
  readonly pollIntervalMs: number;
  readonly auth: OAuth2Client;
  readonly pageTokenStore: PageTokenStore;
}
