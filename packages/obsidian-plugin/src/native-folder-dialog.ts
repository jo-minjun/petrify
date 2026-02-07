// biome-ignore lint/suspicious/noExplicitAny: Electron remote 모듈은 런타임 동적 require
function getElectronRemote(): any {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require('electron')?.remote;
  } catch {
    return undefined;
  }
}

/**
 * Electron 네이티브 폴더 선택 다이얼로그를 열어 경로를 반환한다.
 * Obsidian(Electron) 환경에서만 동작하며, 실패 시 null을 반환한다.
 */
export async function showNativeFolderDialog(
  defaultPath?: string,
  // biome-ignore lint/suspicious/noExplicitAny: 테스트에서 remote를 주입하기 위한 파라미터
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
