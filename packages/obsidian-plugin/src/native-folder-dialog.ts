export interface ElectronRemote {
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
    const remote = electronModule?.remote;
    if (remote && typeof remote === 'object' && 'dialog' in remote) {
      return remote as ElectronRemote;
    }
    return undefined;
  } catch {
    return undefined;
  }
}

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
