import { createDependencyResult } from '../registry.js';
import type { DependencyDetector } from '../registry.js';
import type { ProjectScanResult } from '../../types/ProjectScanResult.js';

export const SQLAlchemyDetector: DependencyDetector = {
  name: 'SQLAlchemy',
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

    const usesSqlAlchemy = result.files.some((file) => file.path.includes('sqlalchemy') || file.path.includes('database') || file.path.includes('db') || file.path.includes('create_engine'));
    if (usesSqlAlchemy) {
      evidence.push('SQLAlchemy usage');
    }

    if (evidence.length < 2) {
      return null;
    }

    return createDependencyResult('SQLAlchemy', evidence, 0.95);
  },
};
