export interface FileSystemPort {
  writeFile(path: string, content: string): Promise<void>;
  writeAsset(dir: string, name: string, data: Uint8Array): Promise<string>;
  exists(path: string): Promise<boolean>;
}
