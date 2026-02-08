export interface OcrRegion {
  text: string;
  x: number;
  y: number;
  width: number;
  height: number;
  /** OCR confidence (0-100). Some OCR engines may not provide this */
  confidence?: number;
}

export interface OcrResult {
  text: string;
  /** Overall average confidence (0-100). Undefined if no regions provide confidence */
  confidence?: number;
  regions: OcrRegion[];
}

export interface OcrOptions {
  /** Confidence threshold (0-100). Regions below this value are ignored */
  confidenceThreshold?: number;
  /** Language code (e.g., 'korean', 'english') */
  language?: string;
}

export interface OcrPort {
  /** Extract text from an image */
  recognize(image: ArrayBuffer, options?: OcrOptions): Promise<OcrResult>;
  /** Terminate OCR engine (resource cleanup) */
  terminate?(): Promise<void>;
}
