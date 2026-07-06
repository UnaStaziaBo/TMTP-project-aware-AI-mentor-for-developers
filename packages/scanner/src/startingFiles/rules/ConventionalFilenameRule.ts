import type { StartingFileRule } from '../registry.js';

const CONVENTIONAL_FILENAMES = new Set([
  'main.py',
  'app.py',
  'server.py',
  'manage.py',
  'index.ts',
  'main.ts',
  'main.tsx',
  'App.tsx',
]);

export const ConventionalFilenameRule: StartingFileRule = {
  name: 'conventional-filename',
  evaluate(context) {
    if (CONVENTIONAL_FILENAMES.has(context.basename)) {
      return { points: 20, reason: `Conventional filename (\`${context.basename}\`)` };
    }
    return null;
  },
};
