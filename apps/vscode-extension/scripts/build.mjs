import { build } from 'esbuild';
import { mkdir, copyFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const watch = process.argv.includes('--watch');
const require = createRequire(import.meta.url);

const extensionConfig = {
  entryPoints: [path.join(root, 'src/extension.ts')],
  bundle: true,
  outfile: path.join(root, 'dist/extension.js'),
  platform: 'node',
  format: 'cjs',
  target: 'node18',
  external: ['vscode'],
  sourcemap: true,
  logLevel: 'info',
};

const webviewConfig = {
  entryPoints: [path.join(root, 'src/webview/main.ts')],
  bundle: true,
  outfile: path.join(root, 'dist/media/main.js'),
  platform: 'browser',
  format: 'iife',
  target: 'es2020',
  jsx: 'automatic',
  // React + React Flow + dagre push the unminified bundle well past esbuild's
  // size-warning threshold; minifying (safe here — it's a build output, not
  // debugged directly) keeps it reasonable for a webview payload.
  minify: !watch,
  sourcemap: true,
  logLevel: 'info',
};

async function copyReactFlowStylesheet() {
  const source = require.resolve('@xyflow/react/dist/style.css');
  const destDir = path.join(root, 'dist/media');
  await mkdir(destDir, { recursive: true });
  await copyFile(source, path.join(destDir, 'reactflow.css'));
}

if (watch) {
  const [extCtx, webCtx] = await Promise.all([
    import('esbuild').then((m) => m.context(extensionConfig)),
    import('esbuild').then((m) => m.context(webviewConfig)),
  ]);
  await copyReactFlowStylesheet();
  await Promise.all([extCtx.watch(), webCtx.watch()]);
} else {
  await Promise.all([build(extensionConfig), build(webviewConfig), copyReactFlowStylesheet()]);
}
