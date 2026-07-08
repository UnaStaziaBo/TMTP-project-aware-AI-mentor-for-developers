import type { FileLesson, KeyConstruct } from './types/FileLesson.js';
import { InvalidAIResponseError } from './errors.js';
import { isNonEmptyString } from './utils.js';

const CONSTRUCT_FIELDS = ['snippet', 'project', 'language', 'architecture'] as const;

function parseKeyConstruct(raw: unknown): KeyConstruct {
  if (typeof raw !== 'object' || raw === null) {
    throw new InvalidAIResponseError('AI response contained a non-object key construct');
  }

  const candidate = raw as Record<string, unknown>;
  for (const field of CONSTRUCT_FIELDS) {
    if (!isNonEmptyString(candidate[field])) {
      throw new InvalidAIResponseError(`AI response's key construct is missing "${field}"`);
    }
  }

  return {
    snippet: candidate.snippet as string,
    project: candidate.project as string,
    language: candidate.language as string,
    architecture: candidate.architecture as string,
  };
}

/**
 * Shape-validates the raw AI response into a FileLesson. Does not (and
 * cannot robustly) verify that each "snippet" is a byte-exact substring of
 * the file — the model may reformat whitespace — so that guarantee is a
 * prompt-level instruction, not a code-enforced one.
 */
export function parseFileLesson(file: string, raw: unknown): FileLesson {
  if (typeof raw !== 'object' || raw === null) {
    throw new InvalidAIResponseError('AI response was not a JSON object');
  }

  const candidate = raw as Record<string, unknown>;

  for (const field of ['title', 'responsibility'] as const) {
    if (!isNonEmptyString(candidate[field])) {
      throw new InvalidAIResponseError(`AI response is missing "${field}"`);
    }
  }

  if (!Array.isArray(candidate.keyConstructs) || candidate.keyConstructs.length === 0) {
    throw new InvalidAIResponseError('AI response is missing a non-empty "keyConstructs" array');
  }

  return {
    file,
    title: candidate.title as string,
    responsibility: candidate.responsibility as string,
    keyConstructs: candidate.keyConstructs.map(parseKeyConstruct),
  };
}
