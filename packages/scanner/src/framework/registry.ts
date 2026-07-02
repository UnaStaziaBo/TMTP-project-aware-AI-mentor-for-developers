import type { ProjectScanResult } from '../types/ProjectScanResult.js';
import type { DetectedFramework } from '../types/DetectedFramework.js';

export interface FrameworkDetector {
  name: string;
  detect(result: ProjectScanResult): DetectedFramework | null;
}

export function createFrameworkResult(name: string, evidence: string[], confidence: number): DetectedFramework {
  return {
    name,
    confidence,
    evidence,
  };
}

export function runFrameworkDetectors(detectors: FrameworkDetector[], result: ProjectScanResult): DetectedFramework[] {
  const detectedFrameworks: DetectedFramework[] = [];

  for (const detector of detectors) {
    const detected = detector.detect(result);
    if (detected) {
      detectedFrameworks.push(detected);
    }
  }

  return detectedFrameworks;
}
