import { createFrameworkResult } from '../registry.js';
import type { FrameworkDetector } from '../registry.js';
import type { ProjectScanResult } from '../../types/ProjectScanResult.js';

function hasTypeScriptLanguage(result: ProjectScanResult): boolean {
  return result.languages.some((language) => language.name === 'TypeScript');
}

export const NestJSDetector: FrameworkDetector = {
  name: 'NestJS',
  detect(result) {
    if (!hasTypeScriptLanguage(result)) {
      return null;
    }

    const evidence: string[] = [];

    const hasPackageJson = result.manifests.some((manifest) => manifest.path.endsWith('package.json'));
    if (hasPackageJson) {
      evidence.push('package.json');
    }

    const hasMainTs = result.files.some((file) => file.path.endsWith('main.ts'));
    if (hasMainTs) {
      evidence.push('main.ts');
    }

    const hasNestImports = result.files.some((file) => file.path.includes('@nestjs'));
    if (hasNestImports) {
      evidence.push('@nestjs imports');
    }

    if (evidence.length < 2) {
      return null;
    }

    const confidence = Math.min(1, evidence.length / 3);
    return createFrameworkResult('NestJS', evidence, confidence);
  },
};
