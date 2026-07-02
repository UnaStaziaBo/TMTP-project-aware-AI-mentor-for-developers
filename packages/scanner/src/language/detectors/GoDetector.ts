import type { LanguageDetector } from '../registry.js';
import { createLanguageResult } from '../registry.js';

export const GoDetector: LanguageDetector = {
  name: 'Go',
  detect(scanResult) {
    const evidence: string[] = [];

    const hasGoFiles = scanResult.files.some((file) => file.path.endsWith('.go'));
    if (hasGoFiles) {
      evidence.push('*.go files');
    }

    const hasGoModule = scanResult.manifests.some((manifest) => manifest.path.endsWith('go.mod'));
    if (hasGoModule) {
      evidence.push('go.mod');
    }

    if (evidence.length === 0) {
      return null;
    }

    const confidence = Math.min(1, evidence.length / 2);
    return createLanguageResult('Go', evidence, confidence);
  },
};
