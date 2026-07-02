import { createDependencyResult } from '../registry.js';
import type { DependencyDetector } from '../registry.js';
import type { ProjectScanResult } from '../../types/ProjectScanResult.js';

export const AlembicDetector: DependencyDetector = {
  name: 'Alembic',
  detect(result) {
    const evidence: string[] = [];

    const hasAlembicFiles = result.files.some((file) => file.path.includes('alembic') || file.path.endsWith('env.py'));
    if (hasAlembicFiles) {
      evidence.push('Alembic migration files');
    }

    const hasPythonManifest = result.manifests.some((manifest) => manifest.path.endsWith('pyproject.toml') || manifest.path.endsWith('requirements.txt'));
    if (hasPythonManifest) {
      evidence.push('Python manifest');
    }

    if (evidence.length < 2) {
      return null;
    }

    return createDependencyResult('Alembic', evidence, 0.9);
  },
};
