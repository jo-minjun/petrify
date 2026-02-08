interface ElectronRemote {
  dialog: {
    showOpenDialog(options: {
      properties: string[];
      defaultPath?: string;
    }): Promise<{ canceled: boolean; filePaths: string[] }>;
  };
}

async function getElectronRemote(): Promise<ElectronRemote | undefined> {
  try {
    // @ts-expect-error electron is provided by Obsidian's Electron runtime, not installed as a dependency
    const electronModule: Record<string, unknown> = await import('electron');
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
  remote?: ElectronRemote,
): Promise<string | null> {
  try {
    const resolvedRemote = remote ?? (await getElectronRemote());
    if (!resolvedRemote?.dialog?.showOpenDialog) {
      return null;
    }

    const result = await resolvedRemote.dialog.showOpenDialog({
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
