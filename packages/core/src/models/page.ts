export interface Page {
  readonly id: string;
  readonly imageData: Uint8Array;
  readonly order: number;
  readonly width: number;
  readonly height: number;
}

export const DEFAULT_PAGE_WIDTH = 1440;
export const DEFAULT_PAGE_HEIGHT = 1920;
