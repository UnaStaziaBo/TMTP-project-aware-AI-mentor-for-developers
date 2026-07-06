import type { StartingFileRule } from '../registry.js';

const REFERENCED_THRESHOLD = 3;

export const ReferencedByManyRule: StartingFileRule = {
  name: 'referenced-by-many',
  evaluate(context) {
    if (context.referencedByCount >= REFERENCED_THRESHOLD) {
      return { points: 15, reason: `Referenced by ${context.referencedByCount} other project files` };
    }
    return null;
  },
};
