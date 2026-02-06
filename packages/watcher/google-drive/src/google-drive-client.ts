import { google } from 'googleapis';
import type { OAuth2Client } from 'google-auth-library';
import type { DriveFile, ChangesResult } from './types.js';

const FIELDS_FILE = 'id, name, mimeType, modifiedTime, md5Checksum, size, parents';
const FIELDS_CHANGES = `nextPageToken, newStartPageToken, changes(fileId, removed, file(${FIELDS_FILE}))`;

export class GoogleDriveClient {
  private readonly drive;

  constructor(auth: OAuth2Client) {
    this.drive = google.drive({ version: 'v3', auth });
  }

  async listFiles(folderId: string): Promise<DriveFile[]> {
    const allFiles: DriveFile[] = [];
    let pageToken: string | undefined;

    do {
      const res = await this.drive.files.list({
        q: `'${folderId}' in parents and trashed = false`,
        fields: `nextPageToken, files(${FIELDS_FILE})`,
        pageSize: 100,
        pageToken,
      });

      for (const file of res.data.files ?? []) {
        allFiles.push(file as DriveFile);
      }

      pageToken = res.data.nextPageToken ?? undefined;
    } while (pageToken);

    return allFiles;
  }

  async getStartPageToken(): Promise<string> {
    const res = await this.drive.changes.getStartPageToken({});
    return res.data.startPageToken!;
  }

  async getChanges(pageToken: string): Promise<ChangesResult> {
    const allChanges: DriveFile[] = [];
    let currentToken = pageToken;
    let newStartPageToken: string | undefined;

    const changes: ChangesResult['changes'] = [];

    do {
      const res = await this.drive.changes.list({
        pageToken: currentToken,
        fields: FIELDS_CHANGES,
        includeRemoved: true,
        pageSize: 100,
      });

      for (const change of res.data.changes ?? []) {
        changes.push({
          fileId: change.fileId ?? '',
          removed: change.removed ?? false,
          file: change.file ? (change.file as DriveFile) : undefined,
          time: change.time ?? '',
        });
      }

      if (res.data.newStartPageToken) {
        newStartPageToken = res.data.newStartPageToken;
        break;
      }

      currentToken = res.data.nextPageToken!;
    } while (currentToken);

    return {
      changes,
      newStartPageToken,
    };
  }

  async downloadFile(fileId: string): Promise<ArrayBuffer> {
    const res = await this.drive.files.get(
      { fileId, alt: 'media' },
      { responseType: 'stream' },
    );

    const chunks: Buffer[] = [];
    for await (const chunk of res.data as AsyncIterable<Buffer>) {
      chunks.push(Buffer.from(chunk));
    }
    const buffer = Buffer.concat(chunks);
    return buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
  }

  async getFile(fileId: string): Promise<DriveFile> {
    const res = await this.drive.files.get({
      fileId,
      fields: FIELDS_FILE,
    });
    return res.data as DriveFile;
  }
}
