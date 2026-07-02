import type { DetectedLanguage } from '../types/DetectedLanguage.js';

export interface LanguageDetector {
  name: string;
  detect(scanResult: {
    files: Array<{ path: string; extension: string }>;
    manifests: Array<{ path: string }>;
  }): DetectedLanguage | null;
}

export function createLanguageResult(name: string, evidence: string[], confidence: number): DetectedLanguage {
  return {
    name,
    confidence,
    evidence,
  };
}
