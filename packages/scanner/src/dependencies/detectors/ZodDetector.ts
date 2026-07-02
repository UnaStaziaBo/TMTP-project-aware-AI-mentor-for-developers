import { createDependencyResult } from '../registry.js';
import type { DependencyDetector } from '../registry.js';
import type { ProjectScanResult } from '../../types/ProjectScanResult.js';

export const ZodDetector: DependencyDetector = {
  name: 'Zod',
  detect(result) {
    const evidence: string[] = [];

    const hasPackageManifest = result.manifests.some((manifest) => manifest.path.endsWith('package.json'));
    if (hasPackageManifest) {
      evidence.push('package.json');
    }

    const usesZod = result.files.some((file) => file.path.includes('zod') || file.path.includes('schema'));
    if (usesZod) {
      evidence.push('Zod schema usage');
    }

    if (evidence.length < 2) {
      return null;
    }

    return createDependencyResult('Zod', evidence, 0.9);
  },
};
