export interface ConversionMetadata {
  readonly source: string | null;
  readonly mtime: number | null;
  readonly keep?: boolean;
}

export interface ConversionMetadataPort {
  getMetadata(id: string): Promise<ConversionMetadata | undefined>;
  formatMetadata(metadata: ConversionMetadata): string;
}
