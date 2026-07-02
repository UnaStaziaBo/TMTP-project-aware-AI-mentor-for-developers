import { createDependencyResult } from '../registry.js';
import type { DependencyDetector } from '../registry.js';
import type { ProjectScanResult } from '../../types/ProjectScanResult.js';

export const PydanticDetector: DependencyDetector = {
  name: 'Pydantic',
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

    const usesBaseModel = result.files.some((file) => file.path.includes('models.py') || file.path.includes('schema'));
    if (usesBaseModel) {
      evidence.push('BaseModel usage');
    }

    if (evidence.length < 2) {
      return null;
    }

    return createDependencyResult('Pydantic', evidence, 0.95);
  },
};
