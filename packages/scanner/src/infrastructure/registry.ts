import type { ProjectScanResult } from '../types/ProjectScanResult.js';
import type { DetectedInfrastructure } from '../types/DetectedInfrastructure.js';

export interface InfrastructureDetector {
  name: string;
  detect(result: ProjectScanResult): DetectedInfrastructure | null;
}

export function createInfrastructureResult(name: string, evidence: string[], confidence: number): DetectedInfrastructure {
  return {
    name,
    confidence,
    evidence,
  };
}

export function runInfrastructureDetectors(detectors: InfrastructureDetector[], result: ProjectScanResult): DetectedInfrastructure[] {
  const detectedInfrastructure: DetectedInfrastructure[] = [];

  for (const detector of detectors) {
    const detected = detector.detect(result);
    if (detected) {
      detectedInfrastructure.push(detected);
    }
  }

  return detectedInfrastructure;
}
