import { createFrameworkResult } from '../registry.js';
import type { FrameworkDetector } from '../registry.js';
import type { ProjectScanResult } from '../../types/ProjectScanResult.js';

function hasPythonLanguage(result: ProjectScanResult): boolean {
  return result.languages.some((language) => language.name === 'Python');
}

export const DjangoDetector: FrameworkDetector = {
  name: 'Django',
  detect(result) {
    if (!hasPythonLanguage(result)) {
      return null;
    }

    const evidence: string[] = [];

    const hasDjangoDependency = result.manifests.some((manifest) => manifest.path.endsWith('requirements.txt') || manifest.path.endsWith('pyproject.toml'));
    if (hasDjangoDependency) {
      evidence.push('Python manifest present');
    }

    const hasSettings = result.files.some((file) => file.path.endsWith('settings.py'));
    if (hasSettings) {
      evidence.push('settings.py');
    }

    const hasUrls = result.files.some((file) => file.path.endsWith('urls.py'));
    if (hasUrls) {
      evidence.push('urls.py');
    }

    if (evidence.length < 2) {
      return null;
    }

    const confidence = Math.min(1, evidence.length / 3);
    return createFrameworkResult('Django', evidence, confidence);
  },
};
