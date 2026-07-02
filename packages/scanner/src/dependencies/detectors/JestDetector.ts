import { createDependencyResult } from '../registry.js';
import type { DependencyDetector } from '../registry.js';
import type { ProjectScanResult } from '../../types/ProjectScanResult.js';

export const JestDetector: DependencyDetector = {
  name: 'Jest',
  detect(result) {
    const evidence: string[] = [];

    const hasPackageManifest = result.manifests.some((manifest) => manifest.path.endsWith('package.json'));
    if (hasPackageManifest) {
      evidence.push('package.json');
    }

    const hasJestConfig = result.files.some((file) => file.path.includes('jest') || file.path.endsWith('jest.config.js') || file.path.endsWith('jest.config.ts'));
    if (hasJestConfig) {
      evidence.push('Jest config');
    }

    if (evidence.length < 2) {
      return null;
    }

    return createDependencyResult('Jest', evidence, 0.9);
  },
};
