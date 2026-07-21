import type { ProjectScanResult } from '@tmpt/scanner';
import type { AIProviderId, FileLesson, PracticePlan, TestConnectionResult } from '@tmpt/ai';

export type StageKey =
  | 'filesystem'
  | 'language'
  | 'framework'
  | 'infrastructure'
  | 'dependency'
  | 'startingFiles';

export interface StageInfo {
  key: StageKey;
  label: string;
}

export const STAGES: StageInfo[] = [
  { key: 'filesystem', label: 'Filesystem' },
  { key: 'language', label: 'Language' },
  { key: 'framework', label: 'Framework' },
  { key: 'infrastructure', label: 'Infrastructure' },
  { key: 'dependency', label: 'Dependency' },
  { key: 'startingFiles', label: 'Starting Files' },
];

/** How confident the developer said they feel working with a toured file. */
export type FileConfidence = 'green' | 'yellow' | 'red';
export type WorkspaceTab = 'overview' | 'startingFiles' | 'guidedTour' | 'projectGraph';

export type ExtensionMessage =
  | { type: 'scanStarted'; projectName: string }
  | { type: 'stageComplete'; stage: StageKey; elapsedMs: number; result: ProjectScanResult }
  | { type: 'scanComplete'; totalElapsedMs: number }
  | { type: 'scanError'; message: string }
  | { type: 'noWorkspace' }
  | { type: 'aiConfigStatus'; configured: boolean; provider?: AIProviderId; model?: string }
  | { type: 'aiTestResult'; result: TestConnectionResult }
  | { type: 'aiError'; message: string }
  | { type: 'fileLessonGenerating'; file: string }
  | { type: 'fileLessonResult'; file: string; lesson: FileLesson; cached: boolean }
  | { type: 'fileLessonError'; file: string; message: string }
  | { type: 'practicePlanGenerating' }
  | { type: 'practicePlanResult'; plan: PracticePlan; cached: boolean }
  | { type: 'practicePlanError'; message: string }
  | { type: 'filePracticeGenerating'; file: string }
  | { type: 'filePracticeResult'; file: string; plan: PracticePlan; cached: boolean }
  | { type: 'filePracticeError'; file: string; message: string }
  | {
      type: 'learningProgress';
      explained: string[];
      practiced: string[];
      mastered: string[];
      commentary: Record<string, { read: number; total: number }>;
    }
  | { type: 'navigateToTab'; tab: WorkspaceTab }
  | { type: 'showAIConfig' }
  | { type: 'startFilePractice'; file: string };

export type WebviewMessage =
  | { type: 'rescan' }
  | { type: 'ready' }
  | { type: 'aiTestConnection'; provider: AIProviderId; apiKey: string; model: string }
  | { type: 'aiSaveConfig'; provider: AIProviderId; apiKey: string; model: string }
  | { type: 'openFile'; file: string }
  | { type: 'explainFile'; file: string }
  | { type: 'submitConfidenceProfile'; ratings: Record<string, FileConfidence> }
  | { type: 'requestFilePractice'; file: string }
  | { type: 'recordPracticeAttempt'; file: string; correct: boolean }
  | { type: 'markFileLearned'; file: string };
