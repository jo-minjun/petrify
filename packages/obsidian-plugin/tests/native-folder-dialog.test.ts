import { beforeEach, describe, expect, it, vi } from 'vitest';
import { showNativeFolderDialog } from '../src/native-folder-dialog.js';

const mockShowOpenDialog = vi.fn();

function createMockRemote() {
  return {
    dialog: {
      showOpenDialog: mockShowOpenDialog,
    },
  };
}

describe('showNativeFolderDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('선택된 폴더 경로를 반환한다', async () => {
    mockShowOpenDialog.mockResolvedValue({
      canceled: false,
      filePaths: ['/Users/test/Documents'],
    });

    const result = await showNativeFolderDialog('/Users/test', createMockRemote());

    expect(result).toBe('/Users/test/Documents');
    expect(mockShowOpenDialog).toHaveBeenCalledWith({
      properties: ['openDirectory'],
      defaultPath: '/Users/test',
    });
  });

  it('사용자가 취소하면 null을 반환한다', async () => {
    mockShowOpenDialog.mockResolvedValue({
      canceled: true,
      filePaths: [],
    });

    const result = await showNativeFolderDialog(undefined, createMockRemote());

    expect(result).toBeNull();
  });

  it('filePaths가 빈 배열이면 null을 반환한다', async () => {
    mockShowOpenDialog.mockResolvedValue({
      canceled: false,
      filePaths: [],
    });

    const result = await showNativeFolderDialog(undefined, createMockRemote());

    expect(result).toBeNull();
  });

  it('remote가 undefined이면 null을 반환한다', async () => {
    const result = await showNativeFolderDialog(undefined, undefined);

    expect(result).toBeNull();
  });

  it('remote.dialog가 없으면 null을 반환한다', async () => {
    const result = await showNativeFolderDialog(undefined, { dialog: undefined });

    expect(result).toBeNull();
  });

  it('showOpenDialog가 예외를 던지면 null을 반환한다', async () => {
    mockShowOpenDialog.mockRejectedValue(new Error('dialog failed'));

    const result = await showNativeFolderDialog(undefined, createMockRemote());

    expect(result).toBeNull();
  });
});
