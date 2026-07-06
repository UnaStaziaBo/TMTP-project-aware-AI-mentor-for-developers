import type { StartingFileRule } from '../registry.js';

const ENTRY_PATTERNS_BY_EXTENSION: Record<string, { pattern: RegExp; reason: string }> = {
  '.py': {
    pattern: /^\s*if\s+__name__\s*==\s*['"]__main__['"]\s*:/m,
    reason: 'Executable entry point (`if __name__ == "__main__":`)',
  },
  '.java': {
    pattern: /public\s+static\s+void\s+main\s*\(/,
    reason: 'Executable entry point (`public static void main`)',
  },
  '.go': {
    pattern: /func\s+main\s*\(\s*\)/,
    reason: 'Executable entry point (`func main()`)',
  },
  '.rs': {
    pattern: /fn\s+main\s*\(\s*\)/,
    reason: 'Executable entry point (`fn main()`)',
  },
};

export const ExecutableEntryRule: StartingFileRule = {
  name: 'executable-entry',
  evaluate(context) {
    const entry = ENTRY_PATTERNS_BY_EXTENSION[context.extension];
    if (entry && entry.pattern.test(context.content)) {
      return { points: 40, reason: entry.reason };
    }
    return null;
  },
};
