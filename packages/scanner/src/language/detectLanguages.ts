import { PythonDetector } from './detectors/PythonDetector.js';
import { TypeScriptDetector } from './detectors/TypeScriptDetector.js';
import { JavaDetector } from './detectors/JavaDetector.js';
import { GoDetector } from './detectors/GoDetector.js';
import { RustDetector } from './detectors/RustDetector.js';
import type { DetectedLanguage } from '../types/DetectedLanguage.js';
import type { ProjectScanResult } from '../types/ProjectScanResult.js';

const detectors = [
  PythonDetector,
  TypeScriptDetector,
  JavaDetector,
  GoDetector,
  RustDetector,
];

export function detectLanguages(scanResult: ProjectScanResult): DetectedLanguage[] {
  const detectedLanguages: DetectedLanguage[] = [];

  for (const detector of detectors) {
    const detected = detector.detect({
      files: scanResult.files,
      manifests: scanResult.manifests,
    });

    if (detected) {
      detectedLanguages.push(detected);
    }
  }

  return detectedLanguages;
}
