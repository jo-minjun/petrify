export interface OcrRegion {
  text: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface OcrResult {
  text: string;
  confidence: number;
  regions: OcrRegion[];
}

export interface OcrPort {
  /** 이미지에서 텍스트 추출 */
  recognize(image: ArrayBuffer): Promise<OcrResult>;
}
