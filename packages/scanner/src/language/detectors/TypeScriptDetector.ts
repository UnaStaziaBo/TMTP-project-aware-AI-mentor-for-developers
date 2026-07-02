import type { LanguageDetector } from '../registry.js';
import { createLanguageResult } from '../registry.js';

export const TypeScriptDetector: LanguageDetector = {
  name: 'TypeScript',
  detect(scanResult) {
    const evidence: string[] = [];

    const hasTypeScriptFiles = scanResult.files.some((file) => file.path.endsWith('.ts') || file.path.endsWith('.tsx'));
    if (hasTypeScriptFiles) {
      evidence.push('*.ts or *.tsx files');
    }

    const hasTsConfig = scanResult.manifests.some((manifest) => manifest.path.endsWith('tsconfig.json'));
    if (hasTsConfig) {
      evidence.push('tsconfig.json');
    }

    const hasPackageJson = scanResult.manifests.some((manifest) => manifest.path.endsWith('package.json'));
    if (hasPackageJson) {
      evidence.push('package.json');
    }

    if (evidence.length === 0) {
      return null;
    }

    const confidence = Math.min(1, evidence.length / 3);
    return createLanguageResult('TypeScript', evidence, confidence);
  },
};
