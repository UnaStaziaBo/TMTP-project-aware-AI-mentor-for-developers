import type { StartingFileRule } from '../registry.js';

const CENTRALITY_THRESHOLD = 5;

export const ImportCentralityRule: StartingFileRule = {
  name: 'import-centrality',
  evaluate(context) {
    if (context.localImportCount >= CENTRALITY_THRESHOLD) {
      return { points: 20, reason: `Imports ${context.localImportCount} project modules` };
    }
    return null;
  },
};
