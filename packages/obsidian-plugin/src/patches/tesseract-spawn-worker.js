const fs = require('node:fs');
const { fileURLToPath } = require('node:url');

/**
 * Obsidian(Electron) 환경용 spawnWorker
 * file:// URL을 Blob URL로 변환하여 Web Worker 보안 정책을 우회
 */
module.exports = ({ workerPath }) => {
  if (workerPath.startsWith('file://')) {
    const localPath = fileURLToPath(workerPath);
    const workerCode = fs.readFileSync(localPath, 'utf-8');
    const blob = new Blob([workerCode], { type: 'application/javascript' });
    const blobUrl = URL.createObjectURL(blob);
    return new Worker(blobUrl);
  }
  return new Worker(workerPath);
};
