import type { OcrOptions, OcrPort, OcrRegion, OcrResult } from '@petrify/core';
import { OcrInitializationError, OcrRecognitionError } from '@petrify/core';

function uint8ArrayToBase64(bytes: Uint8Array): string {
  const CHUNK_SIZE = 0x8000;
  const chunks: string[] = [];

  for (let i = 0; i < bytes.length; i += CHUNK_SIZE) {
    const chunk = bytes.subarray(i, i + CHUNK_SIZE);
    chunks.push(String.fromCharCode(...chunk));
  }

  return btoa(chunks.join(''));
}

export type HttpPostFn = (
  url: string,
  options: { body: string; headers: Record<string, string> },
) => Promise<{ status: number; body: string }>;

export interface GoogleVisionOcrConfig {
  readonly apiKey: string;
  readonly languageHints?: string[];
  readonly httpPost: HttpPostFn;
}

interface VisionVertex {
  x?: number;
  y?: number;
}

interface VisionBlock {
  confidence?: number;
  boundingBox?: { vertices?: VisionVertex[] };
  paragraphs?: VisionParagraph[];
}

interface VisionParagraph {
  words?: VisionWord[];
}

interface VisionWord {
  symbols?: VisionSymbol[];
}

interface VisionSymbol {
  text?: string;
}

interface VisionPage {
  confidence?: number;
  blocks?: VisionBlock[];
}

interface VisionResponse {
  responses?: Array<{
    fullTextAnnotation?: {
      text?: string;
      pages?: VisionPage[];
    };
    error?: { message?: string; code?: number };
  }>;
}

const VISION_API_URL = 'https://vision.googleapis.com/v1/images:annotate';

export class GoogleVisionOcr implements OcrPort {
  private readonly config: GoogleVisionOcrConfig;

  constructor(config: GoogleVisionOcrConfig) {
    this.config = config;
  }

  async recognize(image: ArrayBuffer, options?: OcrOptions): Promise<OcrResult> {
    const response = await this.callApi(image, options);
    return this.mapResponse(response, options?.confidenceThreshold);
  }

  private async callApi(image: ArrayBuffer, options?: OcrOptions): Promise<VisionResponse> {
    const base64Image = uint8ArrayToBase64(new Uint8Array(image));

    const languageHints = options?.language ? [options.language] : this.config.languageHints;

    const body = {
      requests: [
        {
          image: { content: base64Image },
          features: [{ type: 'DOCUMENT_TEXT_DETECTION' }],
          ...(languageHints?.length && {
            imageContext: { languageHints },
          }),
        },
      ],
    };

    let res: { status: number; body: string };
    try {
      res = await this.config.httpPost(`${VISION_API_URL}?key=${this.config.apiKey}`, {
        body: JSON.stringify(body),
        headers: { 'Content-Type': 'application/json' },
      });
    } catch (error) {
      throw new OcrRecognitionError(
        `Vision API request failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    }

    if (res.status === 401 || res.status === 403) {
      throw new OcrInitializationError(
        `Vision API authentication failed (${res.status}): ${res.body}`,
      );
    }

    if (res.status < 200 || res.status >= 300) {
      throw new OcrRecognitionError(`Vision API error (${res.status}): ${res.body}`);
    }

    return JSON.parse(res.body) as VisionResponse;
  }

  private mapResponse(response: VisionResponse, confidenceThreshold?: number): OcrResult {
    const annotation = response.responses?.[0]?.fullTextAnnotation;
    const apiError = response.responses?.[0]?.error;

    if (apiError) {
      throw new OcrRecognitionError(`Vision API error: ${apiError.message ?? 'Unknown error'}`);
    }

    if (!annotation) {
      return { text: '', regions: [] };
    }

    const allBlocks = annotation.pages?.flatMap((page) => page.blocks ?? []) ?? [];
    const threshold = confidenceThreshold ?? 0;

    const regions: OcrRegion[] = allBlocks.map((block) => ({
      text: this.extractBlockText(block),
      confidence: Math.round((block.confidence ?? 0) * 100),
      ...this.extractBoundingBox(block.boundingBox?.vertices),
    }));

    const filteredRegions = regions.filter(
      (r) => r.confidence == null || r.confidence >= threshold,
    );
    const text = filteredRegions.map((r) => r.text).join('\n');

    const pageConfidence = annotation.pages?.[0]?.confidence;
    const confidence = pageConfidence != null ? Math.round(pageConfidence * 100) : undefined;

    return { text, confidence, regions: filteredRegions };
  }

  private extractBlockText(block: VisionBlock): string {
    return (block.paragraphs ?? [])
      .flatMap((p) => p.words ?? [])
      .map((w) => (w.symbols ?? []).map((s) => s.text ?? '').join(''))
      .join(' ');
  }

  private extractBoundingBox(vertices?: VisionVertex[]): {
    x: number;
    y: number;
    width: number;
    height: number;
  } {
    if (!vertices || vertices.length < 4) {
      return { x: 0, y: 0, width: 0, height: 0 };
    }
    const x = vertices[0].x ?? 0;
    const y = vertices[0].y ?? 0;
    const width = (vertices[1].x ?? 0) - x;
    const height = (vertices[2].y ?? 0) - y;
    return { x, y, width, height };
  }
}
