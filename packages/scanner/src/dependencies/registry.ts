import type { ProjectScanResult } from '../types/ProjectScanResult.js';
import type { DetectedDependency } from '../types/DetectedDependency.js';

export interface DependencyDetector {
  name: string;
  detect(result: ProjectScanResult): DetectedDependency | null;
}

export function createDependencyResult(name: string, evidence: string[], confidence: number): DetectedDependency {
  return {
    name,
    confidence,
    evidence,
  };
}

export function runDependencyDetectors(detectors: DependencyDetector[], result: ProjectScanResult): DetectedDependency[] {
  const detectedDependencies: DetectedDependency[] = [];

  for (const detector of detectors) {
    const detected = detector.detect(result);
    if (detected) {
      detectedDependencies.push(detected);
    }
  }

  return detectedDependencies;
}
