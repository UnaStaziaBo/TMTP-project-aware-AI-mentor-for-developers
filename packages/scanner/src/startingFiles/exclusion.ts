import path from 'node:path';

const EXCLUDED_DIRECTORY_SEGMENTS = new Set([
  'venv',
  '.venv',
  'node_modules',
  'dist',
  'build',
  'coverage',
  'tests',
  'test',
  'examples',
  'migrations',
  'generated',
]);

const EXCLUDED_FILENAMES = new Set(['__init__.py', 'index.d.ts']);

const CANDIDATE_EXTENSIONS = new Set(['.py', '.ts', '.tsx', '.js', '.jsx', '.java', '.go', '.rs']);

export function shouldExcludeFromStartingFiles(relativePath: string): boolean {
  const segments = relativePath.split(/[\\/]/);
  const basename = segments[segments.length - 1] ?? '';

  if (segments.slice(0, -1).some((segment) => EXCLUDED_DIRECTORY_SEGMENTS.has(segment))) {
    return true;
  }

  if (EXCLUDED_FILENAMES.has(basename)) {
    return true;
  }

  if (basename.endsWith('.d.ts')) {
    return true;
  }

  if (!CANDIDATE_EXTENSIONS.has(path.extname(basename))) {
    return true;
  }

  return false;
}
