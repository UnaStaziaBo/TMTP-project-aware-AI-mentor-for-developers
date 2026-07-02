import { createDependencyResult } from '../registry.js';
import type { DependencyDetector } from '../registry.js';
import type { ProjectScanResult } from '../../types/ProjectScanResult.js';

export const ReduxDetector: DependencyDetector = {
  name: 'Redux',
  detect(result) {
    const evidence: string[] = [];

    const hasPackageManifest = result.manifests.some((manifest) => manifest.path.endsWith('package.json'));
    if (hasPackageManifest) {
      evidence.push('package.json');
    }

    const usesRedux = result.files.some((file) => file.path.includes('redux') || file.path.includes('store'));
    if (usesRedux) {
      evidence.push('Redux usage');
    }

    if (evidence.length < 2) {
      return null;
    }

    return createDependencyResult('Redux', evidence, 0.9);
  },
};
