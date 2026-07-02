import { createFrameworkResult } from '../registry.js';
import type { FrameworkDetector } from '../registry.js';
import type { ProjectScanResult } from '../../types/ProjectScanResult.js';

function hasPythonLanguage(result: ProjectScanResult): boolean {
  return result.languages.some((language) => language.name === 'Python');
}

export const FastAPIDetector: FrameworkDetector = {
  name: 'FastAPI',
  detect(result) {
    if (!hasPythonLanguage(result)) {
      return null;
    }

    const evidence: string[] = [];

    const hasFastApiDependency = result.manifests.some((manifest) => manifest.path.endsWith('requirements.txt') || manifest.path.endsWith('pyproject.toml'));
    if (hasFastApiDependency) {
      evidence.push('Python manifest present');
    }

    const hasFastApiConstructor = result.files.some((file) => file.path.includes('main.py'));
    if (hasFastApiConstructor) {
      evidence.push('FastAPI entrypoint file');
    }

    const hasRouter = result.files.some((file) => file.path.includes('router.py'));
    if (hasRouter) {
      evidence.push('APIRouter usage');
    }

    const hasModel = result.files.some((file) => file.path.includes('models.py'));
    if (hasModel) {
      evidence.push('Pydantic model file');
    }

    if (evidence.length < 2) {
      return null;
    }

    const confidence = Math.min(1, evidence.length / 3);
    return createFrameworkResult('FastAPI', evidence, confidence);
  },
};
