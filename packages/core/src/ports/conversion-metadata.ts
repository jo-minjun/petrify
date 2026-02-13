export interface PageHash {
  readonly id: string;
  readonly hash: string;
}

export interface ConversionMetadata {
  readonly source: string | null;
  readonly parser: string | null;
  readonly fileHash: string | null;
  readonly pageHashes: readonly PageHash[] | null;
  readonly keep?: boolean;
}

export interface ConversionMetadataPort {
  getMetadata(id: string): Promise<ConversionMetadata | undefined>;
  formatMetadata(metadata: ConversionMetadata): string;
}
