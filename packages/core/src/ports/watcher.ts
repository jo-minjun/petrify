export interface FileChangeEvent {
  readonly id: string;
  readonly name: string;
  readonly extension: string;
  readonly mtime: number;
  readData(): Promise<ArrayBuffer>;
}

export interface WatcherPort {
  onFileChange(handler: (event: FileChangeEvent) => Promise<void>): void;
  onError(handler: (error: Error) => void): void;
  start(): Promise<void>;
  stop(): Promise<void>;
}
