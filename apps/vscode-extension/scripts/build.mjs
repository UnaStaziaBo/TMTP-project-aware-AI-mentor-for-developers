import { build } from 'esbuild';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const watch = process.argv.includes('--watch');

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
  sourcemap: true,
  logLevel: 'info',
};

if (watch) {
  const [extCtx, webCtx] = await Promise.all([
    import('esbuild').then((m) => m.context(extensionConfig)),
    import('esbuild').then((m) => m.context(webviewConfig)),
  ]);
  await Promise.all([extCtx.watch(), webCtx.watch()]);
} else {
  await Promise.all([build(extensionConfig), build(webviewConfig)]);
}
