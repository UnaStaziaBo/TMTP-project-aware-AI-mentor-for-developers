import type { ProjectScanResult } from '@tmpt/scanner';
import type { GuidedTour, TestConnectionResult } from '@tmpt/ai';

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

export type ExtensionMessage =
  | { type: 'scanStarted'; projectName: string }
  | { type: 'stageComplete'; stage: StageKey; elapsedMs: number; result: ProjectScanResult }
  | { type: 'scanComplete'; totalElapsedMs: number }
  | { type: 'scanError'; message: string }
  | { type: 'noWorkspace' }
  | { type: 'aiConfigStatus'; configured: boolean; provider?: string; model?: string }
  | { type: 'aiTestResult'; result: TestConnectionResult }
  | { type: 'aiGenerating' }
  | { type: 'aiResult'; tour: GuidedTour; cached: boolean }
  | { type: 'aiError'; message: string };

export type WebviewMessage =
  | { type: 'rescan' }
  | { type: 'ready' }
  | { type: 'aiTestConnection'; apiKey: string; model: string }
  | { type: 'aiSaveConfig'; apiKey: string; model: string }
  | { type: 'aiGenerate' }
  | { type: 'aiRegenerate' }
  | { type: 'openFile'; file: string };
