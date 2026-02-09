import { Readable } from 'node:stream';
import { WatcherSourceError } from '@petrify/core';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GoogleDriveClient } from '../src/google-drive-client.js';

const mockFiles = {
  list: vi.fn(),
  get: vi.fn(),
};
const mockChanges = {
  list: vi.fn(),
  getStartPageToken: vi.fn(),
};

vi.mock('@googleapis/drive', () => ({
  drive_v3: {
    Drive: vi.fn(() => ({
      files: mockFiles,
      changes: mockChanges,
    })),
  },
}));

describe('GoogleDriveClient', () => {
  let client: GoogleDriveClient;

  beforeEach(() => {
    vi.clearAllMocks();
    client = new GoogleDriveClient({} as unknown as import('google-auth-library').OAuth2Client);
  });

  it('listFiles returns the file list of the specified folder', async () => {
    mockFiles.list.mockResolvedValue({
      data: {
        files: [
          {
            id: 'f1',
            name: 'test.note',
            mimeType: 'application/octet-stream',
            modifiedTime: '2026-01-01T00:00:00Z',
          },
        ],
        nextPageToken: null,
      },
    });

    const files = await client.listFiles('folder-id');

    expect(files).toHaveLength(1);
    expect(files[0].name).toBe('test.note');
  });

  it('listFiles handles pagination', async () => {
    mockFiles.list
      .mockResolvedValueOnce({
        data: {
          files: [
            {
              id: 'f1',
              name: 'a.note',
              mimeType: 'application/octet-stream',
              modifiedTime: '2026-01-01T00:00:00Z',
            },
          ],
          nextPageToken: 'page2',
        },
      })
      .mockResolvedValueOnce({
        data: {
          files: [
            {
              id: 'f2',
              name: 'b.note',
              mimeType: 'application/octet-stream',
              modifiedTime: '2026-01-01T00:00:00Z',
            },
          ],
          nextPageToken: null,
        },
      });

    const files = await client.listFiles('folder-id');

    expect(files).toHaveLength(2);
    expect(mockFiles.list).toHaveBeenCalledTimes(2);
  });

  it('getStartPageToken returns the initial token', async () => {
    mockChanges.getStartPageToken.mockResolvedValue({
      data: { startPageToken: '12345' },
    });

    const token = await client.getStartPageToken();

    expect(token).toBe('12345');
  });

  it('getStartPageToken throws an error when no token is available', async () => {
    mockChanges.getStartPageToken.mockResolvedValue({
      data: { startPageToken: null },
    });

    await expect(client.getStartPageToken()).rejects.toThrow(WatcherSourceError);
  });

  it('getChanges returns the list of changes', async () => {
    mockChanges.list.mockResolvedValue({
      data: {
        changes: [
          {
            fileId: 'f1',
            removed: false,
            file: {
              id: 'f1',
              name: 'test.note',
              mimeType: 'application/octet-stream',
              modifiedTime: '2026-01-01T00:00:00Z',
              parents: ['folder-id'],
            },
            time: '2026-01-01T00:00:00Z',
          },
        ],
        newStartPageToken: '12346',
      },
    });

    const result = await client.getChanges('12345');

    expect(result.changes).toHaveLength(1);
    expect(result.changes[0].fileId).toBe('f1');
    expect(result.newStartPageToken).toBe('12346');
  });

  it('downloadFile reads the stream and returns an ArrayBuffer', async () => {
    const stream = Readable.from([Buffer.from('test-binary-data')]);
    mockFiles.get.mockResolvedValue({ data: stream });

    const buffer = await client.downloadFile('file-id');

    expect(buffer.byteLength).toBe(16);
    const text = new TextDecoder().decode(buffer);
    expect(text).toBe('test-binary-data');
  });

  it('getFile returns a single file metadata', async () => {
    mockFiles.get.mockResolvedValue({
      data: {
        id: 'f1',
        name: 'test.note',
        mimeType: 'application/octet-stream',
        modifiedTime: '2026-01-01T00:00:00Z',
      },
    });

    const file = await client.getFile('f1');

    expect(file.id).toBe('f1');
    expect(file.name).toBe('test.note');
  });
});
