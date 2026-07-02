import { createInfrastructureResult } from '../registry.js';
import type { InfrastructureDetector } from '../registry.js';
import type { ProjectScanResult } from '../../types/ProjectScanResult.js';

export const NginxDetector: InfrastructureDetector = {
  name: 'Nginx',
  detect(result) {
    const nginxFiles = result.files.filter((file) => file.path === 'nginx.conf' || file.path.includes('conf.d/') || file.path.endsWith('.conf'));
    if (nginxFiles.length === 0) {
      return null;
    }

    const evidence = nginxFiles.map((file) => file.path);
    return createInfrastructureResult('Nginx', evidence, 0.8);
  },
};
