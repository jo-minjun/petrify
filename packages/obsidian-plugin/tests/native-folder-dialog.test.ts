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

  it('returns the selected folder path', async () => {
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

  it('returns null when the user cancels', async () => {
    mockShowOpenDialog.mockResolvedValue({
      canceled: true,
      filePaths: [],
    });

    const result = await showNativeFolderDialog(undefined, createMockRemote());

    expect(result).toBeNull();
  });

  it('returns null when filePaths is an empty array', async () => {
    mockShowOpenDialog.mockResolvedValue({
      canceled: false,
      filePaths: [],
    });

    const result = await showNativeFolderDialog(undefined, createMockRemote());

    expect(result).toBeNull();
  });

  it('returns null when remote is undefined', async () => {
    const result = await showNativeFolderDialog(undefined, undefined);

    expect(result).toBeNull();
  });

  it('returns null when remote.dialog is missing', async () => {
    const result = await showNativeFolderDialog(
      undefined,
      {} as Parameters<typeof showNativeFolderDialog>[1],
    );

    expect(result).toBeNull();
  });

  it('returns null when showOpenDialog throws an exception', async () => {
    mockShowOpenDialog.mockRejectedValue(new Error('dialog failed'));

    const result = await showNativeFolderDialog(undefined, createMockRemote());

    expect(result).toBeNull();
  });
});
