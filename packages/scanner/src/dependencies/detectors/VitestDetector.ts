import { createDependencyResult } from '../registry.js';
import type { DependencyDetector } from '../registry.js';
import type { ProjectScanResult } from '../../types/ProjectScanResult.js';

export const VitestDetector: DependencyDetector = {
  name: 'Vitest',
  detect(result) {
    const evidence: string[] = [];

    const hasPackageManifest = result.manifests.some((manifest) => manifest.path.endsWith('package.json'));
    if (hasPackageManifest) {
      evidence.push('package.json');
    }

    const hasVitestConfig = result.files.some((file) => file.path.endsWith('vitest.config.ts') || file.path.endsWith('vitest.config.js'));
    if (hasVitestConfig) {
      evidence.push('vitest config');
    }

    if (evidence.length < 2) {
      return null;
    }

    return createDependencyResult('Vitest', evidence, 0.9);
  },
};
