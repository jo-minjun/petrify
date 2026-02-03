export interface OcrRegion {
  text: string;
  x: number;
  y: number;
  width: number;
  height: number;
  /** OCR 신뢰도 (0-100). 일부 OCR 엔진은 미제공 */
  confidence?: number;
}

export interface OcrResult {
  text: string;
  /** 전체 신뢰도 평균 (0-100). confidence 제공하는 region이 없으면 undefined */
  confidence?: number;
  regions: OcrRegion[];
}

export interface OcrOptions {
  /** confidence 임계값 (0-100). 이 값 미만인 영역은 무시 */
  confidenceThreshold?: number;
  /** 언어 코드 (예: 'korean', 'english') */
  language?: string;
}

export interface OcrPort {
  /** 이미지에서 텍스트 추출 */
  recognize(image: ArrayBuffer, options?: OcrOptions): Promise<OcrResult>;
}
