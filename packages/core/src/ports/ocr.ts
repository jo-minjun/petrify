export interface OcrRegion {
  text: string;
  x: number;
  y: number;
  width: number;
  height: number;
  confidence: number;
}

export interface OcrResult {
  text: string;
  confidence: number;
  regions: OcrRegion[];
}

export interface OcrOptions {
  /** confidence 임계값 (0-1). 이 값 이하인 영역은 무시 */
  confidenceThreshold?: number;
  /** 언어 코드 (예: 'korean', 'english') */
  language?: string;
}

export interface OcrPort {
  /** 이미지에서 텍스트 추출 */
  recognize(image: ArrayBuffer, options?: OcrOptions): Promise<OcrResult>;
}
