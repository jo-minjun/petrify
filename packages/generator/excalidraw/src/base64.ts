/**
 * Converts a Uint8Array to a base64 string.
 * Uses manual conversion logic instead of Buffer
 * to work in both browser (Obsidian) and Node.js environments.
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
