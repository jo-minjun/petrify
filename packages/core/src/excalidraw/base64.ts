/**
 * Uint8Array를 base64 문자열로 변환.
 * 브라우저(Obsidian)와 Node.js 모두에서 동작하도록
 * Buffer 대신 직접 변환 로직 사용.
 */
export function uint8ArrayToBase64(bytes: Uint8Array): string {
  const CHUNK_SIZE = 0x8000;
  const chunks: string[] = [];

  for (let i = 0; i < bytes.length; i += CHUNK_SIZE) {
    const chunk = bytes.subarray(i, i + CHUNK_SIZE);
    chunks.push(String.fromCharCode(...chunk));
  }

  return btoa(chunks.join(''));
}
