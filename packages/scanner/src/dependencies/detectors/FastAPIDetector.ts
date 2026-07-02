import { createDependencyResult } from '../registry.js';
import type { DependencyDetector } from '../registry.js';
import type { ProjectScanResult } from '../../types/ProjectScanResult.js';

export const FastAPIDetector: DependencyDetector = {
  name: 'FastAPI',
  detect(result) {
    const evidence: string[] = [];

    const hasPythonManifest = result.manifests.some((manifest) => manifest.path.endsWith('pyproject.toml') || manifest.path.endsWith('requirements.txt'));
    if (hasPythonManifest) {
      evidence.push('Python manifest');
    }

    const hasFastApiEntry = result.files.some((file) => file.path.includes('main.py') || file.path.includes('router.py'));
    if (hasFastApiEntry) {
      evidence.push('FastAPI entrypoint');
    }

    if (evidence.length < 2) {
      return null;
    }

    return createDependencyResult('FastAPI', evidence, 0.95);
  },
};
