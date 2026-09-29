export interface PageHash {
  readonly id: string;
  readonly hash: string;
}

export interface ConversionMetadata {
  readonly source: string | null;
  /** Source namespace of the producing folder; absent for legacy output. */
  readonly sourceFolder?: string;
  readonly parser: string | null;
  readonly fileHash: string | null;
  readonly pageHashes: readonly PageHash[] | null;
  readonly keep?: boolean;
}

export interface ConversionMetadataPort {
  getMetadata(id: string): Promise<ConversionMetadata | undefined>;
  getContent?(id: string): Promise<string | undefined>;
  formatMetadata(metadata: ConversionMetadata): string;
}
