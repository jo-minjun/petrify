// biome-ignore lint/suspicious/noExplicitAny: Electron remote module requires dynamic require at runtime
function getElectronRemote(): any {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require('electron')?.remote;
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
  // biome-ignore lint/suspicious/noExplicitAny: Parameter for injecting remote in tests
  remote: any = getElectronRemote(),
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
