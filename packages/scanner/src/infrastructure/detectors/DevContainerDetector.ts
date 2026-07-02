import { createInfrastructureResult } from '../registry.js';
import type { InfrastructureDetector } from '../registry.js';
import type { ProjectScanResult } from '../../types/ProjectScanResult.js';

export const DevContainerDetector: InfrastructureDetector = {
  name: 'Dev Container',
  detect(result) {
    const devcontainerFiles = result.files.filter((file) => file.path === '.devcontainer/devcontainer.json' || file.path === '.devcontainer.json' || file.path.includes('.devcontainer/'));
    if (devcontainerFiles.length === 0) {
      return null;
    }

    const evidence = devcontainerFiles.map((file) => file.path);
    return createInfrastructureResult('Dev Container', evidence, 1);
  },
};
