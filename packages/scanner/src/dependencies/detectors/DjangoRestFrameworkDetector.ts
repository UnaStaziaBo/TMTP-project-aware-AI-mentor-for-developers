import { createDependencyResult } from '../registry.js';
import type { DependencyDetector } from '../registry.js';
import type { ProjectScanResult } from '../../types/ProjectScanResult.js';

export const DjangoRestFrameworkDetector: DependencyDetector = {
  name: 'Django REST Framework',
  detect(result) {
    const evidence: string[] = [];

    const hasPyproject = result.manifests.some((manifest) => manifest.path.endsWith('pyproject.toml'));
    if (hasPyproject) {
      evidence.push('pyproject.toml');
    }

    const hasRequirements = result.manifests.some((manifest) => manifest.path.endsWith('requirements.txt'));
    if (hasRequirements) {
      evidence.push('requirements.txt');
    }

    const usesRestFramework = result.files.some((file) => file.path.includes('rest_framework') || file.path.includes('APIView') || file.path.includes('views') || file.path.includes('urls'));
    if (usesRestFramework) {
      evidence.push('Django REST Framework usage');
    }

    if (evidence.length < 2) {
      return null;
    }

    return createDependencyResult('Django REST Framework', evidence, 0.95);
  },
};
