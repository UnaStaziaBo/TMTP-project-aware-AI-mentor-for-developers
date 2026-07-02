import { createFrameworkResult } from '../registry.js';
import type { FrameworkDetector } from '../registry.js';
import type { ProjectScanResult } from '../../types/ProjectScanResult.js';

function hasTypeScriptLanguage(result: ProjectScanResult): boolean {
  return result.languages.some((language) => language.name === 'TypeScript');
}

export const ReactDetector: FrameworkDetector = {
  name: 'React',
  detect(result) {
    if (!hasTypeScriptLanguage(result)) {
      return null;
    }

    const evidence: string[] = [];

    const hasReactDependency = result.manifests.some((manifest) => manifest.path.endsWith('package.json'));
    if (hasReactDependency) {
      evidence.push('package.json');
    }

    const hasReactEntry = result.files.some((file) => file.path.endsWith('main.tsx'));
    if (hasReactEntry) {
      evidence.push('main.tsx');
    }

    const hasAppComponent = result.files.some((file) => file.path.endsWith('App.tsx'));
    if (hasAppComponent) {
      evidence.push('App.tsx');
    }

    const hasViteConfig = result.files.some((file) => file.path.endsWith('vite.config.ts'));
    if (hasViteConfig) {
      evidence.push('vite.config.ts');
    }

    if (evidence.length < 2) {
      return null;
    }

    const confidence = Math.min(1, evidence.length / 4);
    return createFrameworkResult('React', evidence, confidence);
  },
};
