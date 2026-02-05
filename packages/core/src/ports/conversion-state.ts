export interface ConversionStatePort {
  getLastConvertedMtime(id: string): Promise<number | undefined>;
}
