import type { StartingFileRule } from '../registry.js';

const ORCHESTRATION_IMPORT_THRESHOLD = 3;
const ORCHESTRATION_LINE_THRESHOLD = 40;

export const OrchestrationFileRule: StartingFileRule = {
  name: 'large-orchestration-file',
  evaluate(context) {
    if (
      context.localImportCount >= ORCHESTRATION_IMPORT_THRESHOLD &&
      context.lineCount >= ORCHESTRATION_LINE_THRESHOLD
    ) {
      return {
        points: 10,
        reason: `Large orchestration file (${context.lineCount} lines wiring together ${context.localImportCount} modules)`,
      };
    }
    return null;
  },
};
