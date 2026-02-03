import type { Note } from '../models';

export interface ParserPort {
  /** 지원하는 파일 확장자 */
  readonly extensions: string[];

  /** 파일 데이터를 Note 모델로 파싱 */
  parse(data: ArrayBuffer): Promise<Note>;
}
