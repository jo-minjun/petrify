interface ElectronRemote {
  dialog: {
    showOpenDialog(options: {
      properties: string[];
      defaultPath?: string;
    }): Promise<{ canceled: boolean; filePaths: string[] }>;
  };
}

function getElectronRemote(): ElectronRemote | undefined {
  try {
    const electronModule = require('electron');
    return electronModule?.remote as ElectronRemote | undefined;
  } catch {
    return undefined;
  }
}

/**
 * Opens the Electron native folder selection dialog and returns the selected path.
 * Only works in Obsidian (Electron) environments; returns null on failure.
 */
export async function showNativeFolderDialog(
  defaultPath?: string,
  remote: ElectronRemote | undefined = getElectronRemote(),
): Promise<string | null> {
  try {
    if (!remote?.dialog?.showOpenDialog) {
      return null;
    }

    const result = await remote.dialog.showOpenDialog({
      properties: ['openDirectory'],
      defaultPath,
    });

    if (!result.canceled && result.filePaths.length > 0) {
      return result.filePaths[0];
    }
    return null;
  } catch {
    return null;
  }
}
