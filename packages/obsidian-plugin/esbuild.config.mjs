import esbuild from 'esbuild';
import process from 'process';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const prod = process.argv[2] === 'production';

async function copyTesseractFiles() {
  const targetDir = __dirname;

  // Worker 파일 복사
  const workerSrc = path.resolve(
    __dirname,
    '../../node_modules/.pnpm/tesseract.js@7.0.0/node_modules/tesseract.js/dist/worker.min.js'
  );
  await fs.copyFile(workerSrc, path.join(targetDir, 'worker.min.js'));
  console.log('Copied worker.min.js');

  // Core 파일들 복사
  const coreDir = path.resolve(
    __dirname,
    '../../node_modules/.pnpm/tesseract.js-core@7.0.0/node_modules/tesseract.js-core'
  );
  const coreTargetDir = path.join(targetDir, 'tesseract-core');

  try {
    await fs.mkdir(coreTargetDir, { recursive: true });
  } catch {
    // 이미 존재
  }

  const coreFiles = await fs.readdir(coreDir);
  for (const file of coreFiles) {
    if (file.endsWith('.js') || file.endsWith('.wasm')) {
      await fs.copyFile(path.join(coreDir, file), path.join(coreTargetDir, file));
      console.log(`Copied ${file}`);
    }
  }
}

const context = await esbuild.context({
  entryPoints: ['src/main.ts'],
  bundle: true,
  external: ['obsidian', 'electron'],
  format: 'cjs',
  platform: 'node',
  target: 'es2020',
  outfile: 'main.js',
  sourcemap: prod ? false : 'inline',
  treeShaking: true,
});

if (prod) {
  await context.rebuild();
  await copyTesseractFiles();
  process.exit(0);
} else {
  await copyTesseractFiles();
  await context.watch();
  console.log('Watching for changes...');
}
