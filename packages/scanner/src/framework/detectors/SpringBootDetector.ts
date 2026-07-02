import { createFrameworkResult } from '../registry.js';
import type { FrameworkDetector } from '../registry.js';
import type { ProjectScanResult } from '../../types/ProjectScanResult.js';

function hasJavaLanguage(result: ProjectScanResult): boolean {
  return result.languages.some((language) => language.name === 'Java');
}

export const SpringBootDetector: FrameworkDetector = {
  name: 'Spring Boot',
  detect(result) {
    if (!hasJavaLanguage(result)) {
      return null;
    }

    const evidence: string[] = [];

    const hasPom = result.manifests.some((manifest) => manifest.path.endsWith('pom.xml'));
    if (hasPom) {
      evidence.push('pom.xml');
    }

    const hasApplication = result.files.some((file) => file.path.endsWith('Application.java'));
    if (hasApplication) {
      evidence.push('Application.java');
    }

    const hasSpringBootMarker = result.files.some((file) => file.path.includes('spring-boot'));
    if (hasSpringBootMarker) {
      evidence.push('spring-boot dependency');
    }

    if (evidence.length < 2) {
      return null;
    }

    const confidence = Math.min(1, evidence.length / 3);
    return createFrameworkResult('Spring Boot', evidence, confidence);
  },
};
