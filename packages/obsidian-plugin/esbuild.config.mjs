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

// Tesseract.js를 Obsidian(Electron) 환경에 맞게 패치하는 플러그인
const tesseractObsidianPlugin = {
  name: 'tesseract-obsidian',
  setup(build) {
    const patchDir = path.resolve(__dirname, 'src/patches');

    // ./worker/node를 ./worker/browser로 교체 (worker_threads 대신 Web Worker 사용)
    build.onResolve({ filter: /\.\/worker\/node$/ }, (args) => {
      if (args.importer.includes('tesseract.js')) {
        const browserWorkerPath = path.resolve(
          path.dirname(args.importer),
          './worker/browser/index.js'
        );
        return { path: browserWorkerPath };
      }
      return null;
    });

    // spawnWorker를 Obsidian용 패치로 교체 (file:// URL → Blob URL)
    build.onResolve({ filter: /\.\/spawnWorker/ }, (args) => {
      if (args.importer.includes('tesseract.js') && args.importer.includes('browser')) {
        const patchPath = path.join(patchDir, 'tesseract-spawn-worker.js');
        return { path: patchPath };
      }
      return null;
    });
  },
};

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
  plugins: [tesseractObsidianPlugin],
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
