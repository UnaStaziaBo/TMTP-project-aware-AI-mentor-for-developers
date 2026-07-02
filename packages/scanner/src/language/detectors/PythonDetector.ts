import type { LanguageDetector } from '../registry.js';
import { createLanguageResult } from '../registry.js';

export const PythonDetector: LanguageDetector = {
  name: 'Python',
  detect(scanResult) {
    const evidence: string[] = [];

    const hasPythonFiles = scanResult.files.some((file) => file.path.endsWith('.py'));
    if (hasPythonFiles) {
      evidence.push('*.py files');
    }

    const hasPyproject = scanResult.manifests.some((manifest) => manifest.path.endsWith('pyproject.toml'));
    if (hasPyproject) {
      evidence.push('pyproject.toml');
    }

    const hasRequirements = scanResult.manifests.some((manifest) => manifest.path.endsWith('requirements.txt'));
    if (hasRequirements) {
      evidence.push('requirements.txt');
    }

    if (evidence.length === 0) {
      return null;
    }

    const confidence = Math.min(1, evidence.length / 3);
    return createLanguageResult('Python', evidence, confidence);
  },
};
