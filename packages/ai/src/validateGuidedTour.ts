import type { AIContextStartingFile } from './types/AIContext.js';
import type { GuidedTour, TourStop } from './types/GuidedTour.js';

export class InvalidAIResponseError extends Error {}

export const DEFAULT_INTRODUCTION = `Welcome!

I'll guide you through this project.

We'll visit a few important files in the order that makes the code easiest to understand.

Each stop builds on the previous one.

Let's begin.`;

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function parseStop(raw: unknown): TourStop | undefined {
  if (typeof raw !== 'object' || raw === null) return undefined;
  const candidate = raw as Record<string, unknown>;

  if (!isNonEmptyString(candidate.title)) return undefined;
  if (!isNonEmptyString(candidate.file)) return undefined;
  if (!isNonEmptyString(candidate.whyThisFile)) return undefined;
  if (!Array.isArray(candidate.whatToNotice)) return undefined;

  const whatToNotice = candidate.whatToNotice.filter(isNonEmptyString);
  if (whatToNotice.length === 0) return undefined;

  return {
    title: candidate.title,
    file: candidate.file,
    whyThisFile: candidate.whyThisFile,
    whatToNotice,
    nextReason: isNonEmptyString(candidate.nextReason) ? candidate.nextReason : '',
  };
}

/**
 * Shape-validates the raw AI response into a GuidedTour. Malformed individual
 * stops are dropped rather than failing the whole tour; a missing/empty
 * introduction falls back to a deterministic default so the tour always opens
 * with something reliable.
 */
export function parseGuidedTour(raw: unknown): GuidedTour {
  if (typeof raw !== 'object' || raw === null) {
    throw new InvalidAIResponseError('AI response was not a JSON object');
  }

  const candidate = raw as Record<string, unknown>;

  if (!Array.isArray(candidate.stops)) {
    throw new InvalidAIResponseError('AI response is missing "stops"');
  }

  const stops = candidate.stops
    .map(parseStop)
    .filter((stop): stop is TourStop => stop !== undefined);

  return {
    introduction: isNonEmptyString(candidate.introduction) ? candidate.introduction : DEFAULT_INTRODUCTION,
    stops,
  };
}

/**
 * Enforces "never invent files" and "order follows the deterministic ranking":
 * silently drops any stop referencing a file outside the known starting-file
 * candidates, then reorders the survivors to match the scanner's own ranking
 * rather than whatever order the model produced.
 */
export function groundTourStops(
  tour: GuidedTour,
  startingFiles: readonly AIContextStartingFile[],
): GuidedTour {
  const rank = new Map(startingFiles.map((candidate, index) => [candidate.file, index]));
  const validStops = tour.stops
    .filter((stop) => rank.has(stop.file))
    .sort((a, b) => rank.get(a.file)! - rank.get(b.file)!);

  return { ...tour, stops: validStops };
}
