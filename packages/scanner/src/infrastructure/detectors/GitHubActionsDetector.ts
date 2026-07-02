import { createInfrastructureResult } from '../registry.js';
import type { InfrastructureDetector } from '../registry.js';
import type { ProjectScanResult } from '../../types/ProjectScanResult.js';

export const GitHubActionsDetector: InfrastructureDetector = {
  name: 'GitHub Actions',
  detect(result) {
    const workflowFiles = result.files.filter((file) => file.path.includes('.github/workflows/'));
    if (workflowFiles.length === 0) {
      return null;
    }

    const evidence = workflowFiles.map((file) => file.path);
    return createInfrastructureResult('GitHub Actions', evidence, 1);
  },
};
