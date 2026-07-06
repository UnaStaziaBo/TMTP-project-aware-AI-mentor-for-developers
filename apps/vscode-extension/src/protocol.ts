import type { ProjectScanResult } from '@tmpt/scanner';

export type StageKey = 'filesystem' | 'language' | 'framework' | 'infrastructure' | 'dependency';

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
];

export type ExtensionMessage =
  | { type: 'scanStarted'; projectName: string }
  | { type: 'stageComplete'; stage: StageKey; elapsedMs: number; result: ProjectScanResult }
  | { type: 'scanComplete'; totalElapsedMs: number }
  | { type: 'scanError'; message: string }
  | { type: 'noWorkspace' };

export type WebviewMessage = { type: 'rescan' } | { type: 'ready' };
