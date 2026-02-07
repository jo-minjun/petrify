import { drive_v3 } from '@googleapis/drive';
import type { OAuth2Client } from 'google-auth-library';
import type { ChangesResult, DriveFile } from './types.js';

const FIELDS_FILE = 'id, name, mimeType, modifiedTime, md5Checksum, size, parents';
const FIELDS_CHANGES = `nextPageToken, newStartPageToken, changes(fileId, removed, file(${FIELDS_FILE}))`;

function toDriveFile(data: Record<string, unknown>): DriveFile {
  const { id, name, mimeType, modifiedTime } = data;
  if (
    typeof id !== 'string' ||
    typeof name !== 'string' ||
    typeof mimeType !== 'string' ||
    typeof modifiedTime !== 'string'
  ) {
    throw new Error(
      `Invalid Drive API response: missing required fields (id=${String(id)}, name=${String(name)})`,
    );
  }
  return {
    id,
    name,
    mimeType,
    modifiedTime,
    md5Checksum: typeof data.md5Checksum === 'string' ? data.md5Checksum : undefined,
    size: typeof data.size === 'string' ? data.size : undefined,
    parents: Array.isArray(data.parents) ? (data.parents as string[]) : undefined,
  };
}

export class GoogleDriveClient {
  private readonly drive;

  constructor(auth: OAuth2Client) {
    this.drive = new drive_v3.Drive({ auth });
  }

  async listFiles(folderId: string): Promise<DriveFile[]> {
    const allFiles: DriveFile[] = [];
    let pageToken: string | undefined;

    do {
      const safeFolderId = folderId.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
      const res = await this.drive.files.list({
        q: `'${safeFolderId}' in parents and trashed = false`,
        fields: `nextPageToken, files(${FIELDS_FILE})`,
        pageSize: 100,
        pageToken,
      });

      for (const file of res.data.files ?? []) {
        allFiles.push(toDriveFile(file as Record<string, unknown>));
      }

      pageToken = res.data.nextPageToken ?? undefined;
    } while (pageToken);

    return allFiles;
  }

  async listFolders(parentFolderId?: string): Promise<DriveFile[]> {
    const allFolders: DriveFile[] = [];
    let pageToken: string | undefined;

    const parent = parentFolderId
      ? parentFolderId.replace(/\\/g, '\\\\').replace(/'/g, "\\'")
      : 'root';
    const query = `'${parent}' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false`;

    do {
      const res = await this.drive.files.list({
        q: query,
        fields: `nextPageToken, files(${FIELDS_FILE})`,
        pageSize: 100,
        pageToken,
        orderBy: 'name',
      });

      for (const file of res.data.files ?? []) {
        allFolders.push(toDriveFile(file as Record<string, unknown>));
      }

      pageToken = res.data.nextPageToken ?? undefined;
    } while (pageToken);

    return allFolders;
  }

  async getStartPageToken(): Promise<string> {
    const res = await this.drive.changes.getStartPageToken({});
    if (!res.data.startPageToken) {
      throw new Error('Drive API did not return a startPageToken');
    }
    return res.data.startPageToken;
  }

  async getChanges(pageToken: string): Promise<ChangesResult> {
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
          file: change.file ? toDriveFile(change.file as Record<string, unknown>) : undefined,
          time: change.time ?? '',
        });
      }

      if (res.data.newStartPageToken) {
        newStartPageToken = res.data.newStartPageToken;
        break;
      }

      currentToken = res.data.nextPageToken ?? '';
    } while (currentToken);

    return {
      changes,
      newStartPageToken,
    };
  }

  async downloadFile(fileId: string): Promise<ArrayBuffer> {
    const res = await this.drive.files.get({ fileId, alt: 'media' }, { responseType: 'stream' });

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
    return toDriveFile(res.data as Record<string, unknown>);
  }
}
