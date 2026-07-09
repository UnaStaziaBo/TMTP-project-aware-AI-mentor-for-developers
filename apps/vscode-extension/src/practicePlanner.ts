import type { ScenarioDifficulty, ScenarioFocus } from '@tmpt/ai';
import type { FileConfidence } from './protocol.js';

const MIN_SCENARIOS = 4;
const MAX_SCENARIOS = 8;

const WEIGHT_BY_CONFIDENCE: Record<FileConfidence, number> = {
  red: 3,
  yellow: 2,
  green: 1,
};

const OPTION_COUNT_BY_DIFFICULTY: Record<ScenarioDifficulty, number> = {
  intro: 3,
  intermediate: 4,
  advanced: 5,
};

/**
 * Smooth weighted round-robin (the algorithm nginx uses to spread weighted
 * upstreams): picks `count` files from `files`, favoring higher-weight files
 * more often, while naturally spacing out repeats instead of clustering
 * them. Deterministic — same ratings always produce the same sequence, so
 * the practice plan cache stays stable.
 */
function weightedRoundRobin(files: readonly string[], weightOf: (file: string) => number, count: number): string[] {
  const state = files.map((file) => ({ file, weight: weightOf(file), current: 0 }));
  const totalWeight = state.reduce((sum, s) => sum + s.weight, 0);
  const picks: string[] = [];

  for (let i = 0; i < count; i += 1) {
    for (const s of state) {
      s.current += s.weight;
    }
    let best = state[0]!;
    for (const s of state) {
      if (s.current > best.current) {
        best = s;
      }
    }
    picks.push(best.file);
    best.current -= totalWeight;
  }

  return picks;
}

function difficultyFor(index: number, total: number): ScenarioDifficulty {
  if (index < total / 3) return 'intro';
  if (index < (2 * total) / 3) return 'intermediate';
  return 'advanced';
}

/**
 * Builds the option set for one scenario: the focus file plus the next
 * distractors cycling through the full toured-file list, then sorted back
 * into tour order so the choices always read top-to-bottom the same way
 * the "Where Should I Start?" list did.
 */
function buildOptions(focusFile: string, allFiles: readonly string[], optionCount: number): string[] {
  const focusIndex = allFiles.indexOf(focusFile);
  const count = Math.min(optionCount, allFiles.length);
  const picked = new Set<string>([focusFile]);

  for (let offset = 1; picked.size < count; offset += 1) {
    picked.add(allFiles[(focusIndex + offset) % allFiles.length]!);
  }

  return allFiles.filter((file) => picked.has(file));
}

/**
 * Deterministically plans which toured file each practice scenario centers
 * on and how hard it should be. The AI never chooses files or options here —
 * it only writes the situation/explanation text for the slots this produces
 * (see PracticePlanContext). Files rated "red" show up far more often than
 * files rated "green", per the self-assessment's whole purpose: strengthen
 * weak spots instead of re-testing what's already understood.
 */
export function buildScenarioPlan(
  touredFiles: readonly string[],
  ratings: Readonly<Record<string, FileConfidence>>,
): ScenarioFocus[] {
  if (touredFiles.length === 0) {
    return [];
  }

  const count = Math.min(MAX_SCENARIOS, Math.max(MIN_SCENARIOS, touredFiles.length));
  const weightOf = (file: string) => WEIGHT_BY_CONFIDENCE[ratings[file] ?? 'yellow'];
  const focusSequence = weightedRoundRobin(touredFiles, weightOf, count);

  return focusSequence.map((file, index) => {
    const difficulty = difficultyFor(index, count);
    return {
      file,
      options: buildOptions(file, touredFiles, OPTION_COUNT_BY_DIFFICULTY[difficulty]),
      difficulty,
    };
  });
}

const SINGLE_FILE_DIFFICULTIES: readonly ScenarioDifficulty[] = ['intro', 'intermediate', 'advanced'];

/**
 * Same building blocks as buildScenarioPlan, but every slot centers on one
 * chosen file — used by the Project Knowledge Map's "Practice this File",
 * where the developer picked the file directly instead of it being chosen
 * for them by confidence weighting.
 */
export function buildSingleFileScenarioPlan(file: string, allFiles: readonly string[]): ScenarioFocus[] {
  return SINGLE_FILE_DIFFICULTIES.map((difficulty) => ({
    file,
    options: buildOptions(file, allFiles, OPTION_COUNT_BY_DIFFICULTY[difficulty]),
    difficulty,
  }));
}
