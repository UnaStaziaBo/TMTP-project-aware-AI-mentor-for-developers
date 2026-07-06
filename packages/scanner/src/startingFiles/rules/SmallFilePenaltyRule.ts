import type { StartingFileRule } from '../registry.js';

const SMALL_FILE_LINE_THRESHOLD = 5;

export const SmallFilePenaltyRule: StartingFileRule = {
  name: 'small-file-penalty',
  evaluate(context) {
    if (context.lineCount < SMALL_FILE_LINE_THRESHOLD) {
      return { points: -15, reason: `Very small file (${context.lineCount} lines)` };
    }
    return null;
  },
};
