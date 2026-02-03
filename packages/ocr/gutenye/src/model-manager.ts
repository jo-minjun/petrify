const BASE_URL = 'https://cdn.jsdelivr.net/npm/@gutenye/ocr-models@1.4.2/dist';

export interface ModelConfig {
  detectionUrl: string;
  recognitionUrl: string;
  dictionaryUrl: string;
}

export interface ModelPaths {
  detectionPath: string;
  recognitionPath: string;
  dictionaryPath: string;
}

const KOREAN_CONFIG: ModelConfig = {
  detectionUrl: `${BASE_URL}/ch_PP-OCRv4_det_infer.onnx`,
  recognitionUrl: `${BASE_URL}/korean_PP-OCRv4_rec_infer.onnx`,
  dictionaryUrl: `${BASE_URL}/korean_dict.txt`,
};

const CHINESE_CONFIG: ModelConfig = {
  detectionUrl: `${BASE_URL}/ch_PP-OCRv4_det_infer.onnx`,
  recognitionUrl: `${BASE_URL}/ch_PP-OCRv4_rec_infer.onnx`,
  dictionaryUrl: `${BASE_URL}/ppocr_keys_v1.txt`,
};

const ENGLISH_CONFIG: ModelConfig = {
  detectionUrl: `${BASE_URL}/ch_PP-OCRv4_det_infer.onnx`,
  recognitionUrl: `${BASE_URL}/en_PP-OCRv4_rec_infer.onnx`,
  dictionaryUrl: `${BASE_URL}/en_dict.txt`,
};

export class ModelManager {
  private readonly config: ModelConfig;
  private cachedPaths: ModelPaths | null = null;

  constructor(config: ModelConfig) {
    this.config = config;
  }

  static korean(): ModelManager {
    return new ModelManager(KOREAN_CONFIG);
  }

  static chinese(): ModelManager {
    return new ModelManager(CHINESE_CONFIG);
  }

  static english(): ModelManager {
    return new ModelManager(ENGLISH_CONFIG);
  }

  getConfig(): ModelConfig {
    return { ...this.config };
  }

  getModelPaths(): ModelPaths {
    if (this.cachedPaths) {
      return this.cachedPaths;
    }

    // 브라우저 환경에서는 파일 시스템 접근 불가하므로 URL을 직접 사용
    this.cachedPaths = {
      detectionPath: this.config.detectionUrl,
      recognitionPath: this.config.recognitionUrl,
      dictionaryPath: this.config.dictionaryUrl,
    };

    return this.cachedPaths;
  }
}
