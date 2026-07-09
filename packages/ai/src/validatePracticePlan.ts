import type { PracticePlan, PracticeScenario } from './types/PracticePlan.js';
import type { ScenarioFocus } from './types/PracticePlanContext.js';
import { InvalidAIResponseError } from './errors.js';
import { isNonEmptyString } from './utils.js';

/**
 * Zips the AI's situation/explanation text positionally onto the
 * deterministic ScenarioFocus list — the file, options, and correct answer
 * always come from the deterministic plan, never from the model. If the
 * model returns fewer entries than requested, the plan is truncated to
 * match rather than failing outright (the practice set still renders, just
 * shorter).
 */
export function parsePracticePlan(raw: unknown, scenarios: readonly ScenarioFocus[]): PracticePlan {
  if (typeof raw !== 'object' || raw === null) {
    throw new InvalidAIResponseError('AI response was not a JSON object');
  }

  const candidate = raw as Record<string, unknown>;
  if (!Array.isArray(candidate.scenarios)) {
    throw new InvalidAIResponseError('AI response is missing a "scenarios" array');
  }

  const count = Math.min(candidate.scenarios.length, scenarios.length);
  if (count === 0) {
    throw new InvalidAIResponseError('AI response did not return any usable scenarios');
  }

  const result: PracticeScenario[] = [];
  for (let i = 0; i < count; i += 1) {
    const entry = candidate.scenarios[i];
    if (typeof entry !== 'object' || entry === null) {
      throw new InvalidAIResponseError(`AI response's scenario ${i} was not a JSON object`);
    }
    const entryCandidate = entry as Record<string, unknown>;
    if (!isNonEmptyString(entryCandidate.situation) || !isNonEmptyString(entryCandidate.explanation)) {
      throw new InvalidAIResponseError(`AI response's scenario ${i} is missing "situation" or "explanation"`);
    }

    const focus = scenarios[i]!;
    result.push({
      situation: entryCandidate.situation,
      explanation: entryCandidate.explanation,
      options: focus.options,
      correctOption: focus.file,
    });
  }

  return { scenarios: result };
}
