import { createDependencyResult } from '../registry.js';
import type { DependencyDetector } from '../registry.js';
import type { ProjectScanResult } from '../../types/ProjectScanResult.js';

export const ReactRouterDetector: DependencyDetector = {
  name: 'React Router',
  detect(result) {
    const evidence: string[] = [];

    const hasPackageManifest = result.manifests.some((manifest) => manifest.path.endsWith('package.json'));
    if (hasPackageManifest) {
      evidence.push('package.json');
    }

    const hasRouterUsage = result.files.some((file) => file.path.includes('BrowserRouter') || file.path.includes('Routes') || file.path.includes('react-router') || file.path.includes('router'));
    if (hasRouterUsage) {
      evidence.push('router usage');
    }

    if (evidence.length < 2) {
      return null;
    }

    return createDependencyResult('React Router', evidence, 0.95);
  },
};
