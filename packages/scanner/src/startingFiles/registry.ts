export interface StartingFileContext {
  relativePath: string;
  basename: string;
  extension: string;
  content: string;
  lineCount: number;
  localImportCount: number;
  referencedByCount: number;
}

export interface StartingFileRuleResult {
  points: number;
  reason: string;
}

export interface StartingFileRule {
  name: string;
  evaluate(context: StartingFileContext): StartingFileRuleResult | null;
}

export function runStartingFileRules(
  rules: StartingFileRule[],
  context: StartingFileContext,
): { score: number; reasons: string[] } {
  let score = 0;
  const reasons: string[] = [];

  for (const rule of rules) {
    const result = rule.evaluate(context);
    if (result) {
      score += result.points;
      reasons.push(result.reason);
    }
  }

  return { score, reasons };
}
