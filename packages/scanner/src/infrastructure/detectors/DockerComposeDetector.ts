import { createInfrastructureResult } from '../registry.js';
import type { InfrastructureDetector } from '../registry.js';
import type { ProjectScanResult } from '../../types/ProjectScanResult.js';

export const DockerComposeDetector: InfrastructureDetector = {
  name: 'Docker Compose',
  detect(result) {
    const evidence: string[] = [];

    const hasComposeFile = result.files.some((file) => file.path === 'docker-compose.yml' || file.path === 'docker-compose.yaml' || file.path === 'compose.yaml' || file.path === 'compose.yml');
    if (hasComposeFile) {
      evidence.push('docker-compose.yml');
    }

    if (evidence.length < 1) {
      return null;
    }

    return createInfrastructureResult('Docker Compose', evidence, 1);
  },
};
