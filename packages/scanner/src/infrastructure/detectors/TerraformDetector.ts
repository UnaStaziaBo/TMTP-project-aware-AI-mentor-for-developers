import { createInfrastructureResult } from '../registry.js';
import type { InfrastructureDetector } from '../registry.js';
import type { ProjectScanResult } from '../../types/ProjectScanResult.js';

export const TerraformDetector: InfrastructureDetector = {
  name: 'Terraform',
  detect(result) {
    const terraformFiles = result.files.filter((file) => file.path.endsWith('.tf'));
    if (terraformFiles.length === 0) {
      return null;
    }

    const evidence = terraformFiles.map((file) => file.path);
    return createInfrastructureResult('Terraform', evidence, 1);
  },
};
