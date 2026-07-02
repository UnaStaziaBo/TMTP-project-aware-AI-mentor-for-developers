import { createDependencyResult } from '../registry.js';
import type { DependencyDetector } from '../registry.js';
import type { ProjectScanResult } from '../../types/ProjectScanResult.js';

export const JWTDetector: DependencyDetector = {
  name: 'JWT',
  detect(result) {
    const evidence: string[] = [];

    const hasPackageManifest = result.manifests.some((manifest) => manifest.path.endsWith('package.json'));
    if (hasPackageManifest) {
      evidence.push('package.json');
    }

    const hasJwtUsage = result.files.some((file) => file.path.includes('jwt') || file.path.includes('jsonwebtoken'));
    if (hasJwtUsage) {
      evidence.push('JWT usage');
    }

    if (evidence.length < 2) {
      return null;
    }

    return createDependencyResult('JWT', evidence, 0.95);
  },
};
