const fs = require('node:fs');
const { fileURLToPath } = require('node:url');

/**
 * Obsidian(Electron) 환경용 spawnWorker
 * file:// URL을 Blob URL로 변환하여 Web Worker 보안 정책을 우회
 */
module.exports = ({ workerPath }) => {
  if (workerPath.startsWith('file://')) {
    // file:// URL을 로컬 경로로 변환
    const localPath = fileURLToPath(workerPath);
    // 파일 내용을 동기적으로 읽음
    const workerCode = fs.readFileSync(localPath, 'utf-8');
    // Blob URL 생성
    const blob = new Blob([workerCode], { type: 'application/javascript' });
    const blobUrl = URL.createObjectURL(blob);
    return new Worker(blobUrl);
  }
  return new Worker(workerPath);
};
