import type { LanguageDetector } from '../registry.js';
import { createLanguageResult } from '../registry.js';

export const JavaDetector: LanguageDetector = {
  name: 'Java',
  detect(scanResult) {
    const evidence: string[] = [];

    const hasJavaFiles = scanResult.files.some((file) => file.path.endsWith('.java'));
    if (hasJavaFiles) {
      evidence.push('*.java files');
    }

    const hasPom = scanResult.manifests.some((manifest) => manifest.path.endsWith('pom.xml'));
    if (hasPom) {
      evidence.push('pom.xml');
    }

    const hasGradle = scanResult.manifests.some((manifest) => manifest.path.endsWith('build.gradle'));
    if (hasGradle) {
      evidence.push('build.gradle');
    }

    if (evidence.length === 0) {
      return null;
    }

    const confidence = Math.min(1, evidence.length / 3);
    return createLanguageResult('Java', evidence, confidence);
  },
};
