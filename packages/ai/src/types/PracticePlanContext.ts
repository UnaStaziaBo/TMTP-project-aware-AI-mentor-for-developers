export type ScenarioDifficulty = 'intro' | 'intermediate' | 'advanced';

/**
 * The deterministic plan for one scenario: which toured file is the correct
 * answer, and the full set of options to present. The AI only ever writes
 * the situation/explanation text for a given ScenarioFocus — it never
 * chooses the file, the options, or the difficulty. That keeps every
 * scenario grounded in files the developer actually toured.
 */
export interface ScenarioFocus {
  file: string;
  options: string[];
  difficulty: ScenarioDifficulty;
}

export interface FileSummary {
  file: string;
  title: string;
  responsibility: string;
}

export interface PracticePlanContext {
  files: FileSummary[];
  scenarios: ScenarioFocus[];
}
