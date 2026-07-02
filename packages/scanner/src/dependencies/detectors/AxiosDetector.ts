import { createDependencyResult } from '../registry.js';
import type { DependencyDetector } from '../registry.js';
import type { ProjectScanResult } from '../../types/ProjectScanResult.js';

export const AxiosDetector: DependencyDetector = {
  name: 'Axios',
  detect(result) {
    const evidence: string[] = [];

    const hasPackageManifest = result.manifests.some((manifest) => manifest.path.endsWith('package.json'));
    if (hasPackageManifest) {
      evidence.push('package.json');
    }

    const hasAxiosUsage = result.files.some((file) => file.path.includes('axios.create') || file.path.includes('axios') || file.path.includes('api'));
    if (hasAxiosUsage) {
      evidence.push('axios usage');
    }

    if (evidence.length < 2) {
      return null;
    }

    return createDependencyResult('Axios', evidence, 0.95);
  },
};
