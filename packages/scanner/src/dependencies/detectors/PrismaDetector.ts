import { createDependencyResult } from '../registry.js';
import type { DependencyDetector } from '../registry.js';
import type { ProjectScanResult } from '../../types/ProjectScanResult.js';

export const PrismaDetector: DependencyDetector = {
  name: 'Prisma',
  detect(result) {
    const evidence: string[] = [];

    const hasPrismaSchema = result.files.some((file) => file.path.endsWith('schema.prisma'));
    if (hasPrismaSchema) {
      evidence.push('schema.prisma');
    }

    const hasPackageManifest = result.manifests.some((manifest) => manifest.path.endsWith('package.json'));
    if (hasPackageManifest) {
      evidence.push('package.json');
    }

    if (evidence.length < 2) {
      return null;
    }

    return createDependencyResult('Prisma', evidence, 0.9);
  },
};
