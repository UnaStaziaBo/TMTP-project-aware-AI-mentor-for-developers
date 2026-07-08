import type { DetectedLanguage } from '@tmpt/scanner';

/**
 * The project determines which language the AI should teach in: the
 * scanner's own highest-confidence detected language, not an AI opinion.
 * Returns null if no language was detected at all.
 */
export function determinePrimaryLanguage(languages: readonly DetectedLanguage[]): string | null {
  const sorted = [...languages].sort((a, b) => b.confidence - a.confidence);
  return sorted[0]?.name ?? null;
}
