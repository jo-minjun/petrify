import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Readable } from 'stream';
import { GoogleDriveClient } from '../src/google-drive-client.js';

const mockFiles = {
  list: vi.fn(),
  get: vi.fn(),
};
const mockChanges = {
  list: vi.fn(),
  getStartPageToken: vi.fn(),
};

vi.mock('googleapis', () => ({
  google: {
    drive: vi.fn(() => ({
      files: mockFiles,
      changes: mockChanges,
    })),
  },
}));

describe('GoogleDriveClient', () => {
  let client: GoogleDriveClient;

  beforeEach(() => {
    vi.clearAllMocks();
    client = new GoogleDriveClient({} as any);
  });

  it('listFiles는 지정 폴더의 파일 목록을 반환한다', async () => {
    mockFiles.list.mockResolvedValue({
      data: {
        files: [
          { id: 'f1', name: 'test.note', mimeType: 'application/octet-stream', modifiedTime: '2026-01-01T00:00:00Z' },
        ],
        nextPageToken: null,
      },
    });

    const files = await client.listFiles('folder-id');

    expect(files).toHaveLength(1);
    expect(files[0].name).toBe('test.note');
  });

  it('listFiles는 페이지네이션을 처리한다', async () => {
    mockFiles.list
      .mockResolvedValueOnce({
        data: {
          files: [{ id: 'f1', name: 'a.note', mimeType: 'application/octet-stream', modifiedTime: '2026-01-01T00:00:00Z' }],
          nextPageToken: 'page2',
        },
      })
      .mockResolvedValueOnce({
        data: {
          files: [{ id: 'f2', name: 'b.note', mimeType: 'application/octet-stream', modifiedTime: '2026-01-01T00:00:00Z' }],
          nextPageToken: null,
        },
      });

    const files = await client.listFiles('folder-id');

    expect(files).toHaveLength(2);
    expect(mockFiles.list).toHaveBeenCalledTimes(2);
  });

  it('getStartPageToken은 초기 토큰을 반환한다', async () => {
    mockChanges.getStartPageToken.mockResolvedValue({
      data: { startPageToken: '12345' },
    });

    const token = await client.getStartPageToken();

    expect(token).toBe('12345');
  });

  it('getChanges는 변경사항 목록을 반환한다', async () => {
    mockChanges.list.mockResolvedValue({
      data: {
        changes: [
          { fileId: 'f1', removed: false, file: { id: 'f1', name: 'test.note', modifiedTime: '2026-01-01T00:00:00Z', parents: ['folder-id'] }, time: '2026-01-01T00:00:00Z' },
        ],
        newStartPageToken: '12346',
      },
    });

    const result = await client.getChanges('12345');

    expect(result.changes).toHaveLength(1);
    expect(result.changes[0].fileId).toBe('f1');
    expect(result.newStartPageToken).toBe('12346');
  });

  it('downloadFile은 스트림을 읽어 ArrayBuffer를 반환한다', async () => {
    const stream = Readable.from([Buffer.from('test-binary-data')]);
    mockFiles.get.mockResolvedValue({ data: stream });

    const buffer = await client.downloadFile('file-id');

    expect(buffer.byteLength).toBe(16);
    const text = new TextDecoder().decode(buffer);
    expect(text).toBe('test-binary-data');
  });

  it('getFile은 단일 파일 메타데이터를 반환한다', async () => {
    mockFiles.get.mockResolvedValue({
      data: { id: 'f1', name: 'test.note', mimeType: 'application/octet-stream', modifiedTime: '2026-01-01T00:00:00Z' },
    });

    const file = await client.getFile('f1');

    expect(file.id).toBe('f1');
    expect(file.name).toBe('test.note');
  });
});
