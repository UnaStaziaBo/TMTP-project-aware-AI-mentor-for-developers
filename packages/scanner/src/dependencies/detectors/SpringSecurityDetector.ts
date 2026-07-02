import { createDependencyResult } from '../registry.js';
import type { DependencyDetector } from '../registry.js';
import type { ProjectScanResult } from '../../types/ProjectScanResult.js';

export const SpringSecurityDetector: DependencyDetector = {
  name: 'Spring Security',
  detect(result) {
    const evidence: string[] = [];

    const hasPom = result.manifests.some((manifest) => manifest.path.endsWith('pom.xml'));
    if (hasPom) {
      evidence.push('pom.xml');
    }

    const usesSecurity = result.files.some((file) => file.path.includes('Security') || file.path.includes('spring-security'));
    if (usesSecurity) {
      evidence.push('Spring Security usage');
    }

    if (evidence.length < 2) {
      return null;
    }

    return createDependencyResult('Spring Security', evidence, 0.95);
  },
};
