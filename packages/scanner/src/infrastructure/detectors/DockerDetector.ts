import { createInfrastructureResult } from '../registry.js';
import type { InfrastructureDetector } from '../registry.js';
import type { ProjectScanResult } from '../../types/ProjectScanResult.js';

export const DockerDetector: InfrastructureDetector = {
  name: 'Docker',
  detect(result) {
    const evidence: string[] = [];

    const hasDockerfile = result.files.some((file) => file.path === 'Dockerfile');
    if (hasDockerfile) {
      evidence.push('Dockerfile');
    }

    const hasComposeFile = result.files.some((file) => file.path === 'docker-compose.yml' || file.path === 'docker-compose.yaml' || file.path === 'compose.yaml' || file.path === 'compose.yml');
    if (hasComposeFile) {
      evidence.push('docker compose file');
    }

    const hasReadmeReference = result.files.some((file) => file.path.toLowerCase().includes('readme') && file.path.endsWith('.md'));
    if (hasReadmeReference) {
      const readme = result.files.find((file) => file.path.toLowerCase().includes('readme') && file.path.endsWith('.md'));
      if (readme) {
        evidence.push(`README reference: ${readme.path}`);
      }
    }

    if (evidence.length < 1) {
      return null;
    }

    const confidence = evidence.length >= 2 ? 1 : 0.8;
    return createInfrastructureResult('Docker', evidence, confidence);
  },
};
