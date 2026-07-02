import { createInfrastructureResult } from '../registry.js';
import type { InfrastructureDetector } from '../registry.js';
import type { ProjectScanResult } from '../../types/ProjectScanResult.js';

export const KubernetesDetector: InfrastructureDetector = {
  name: 'Kubernetes',
  detect(result) {
    const evidence: string[] = [];

    const k8sFiles = result.files.filter((file) => file.path.includes('k8s/') || file.path.endsWith('deployment.yaml') || file.path.endsWith('service.yaml') || file.path.endsWith('ingress.yaml'));
    if (k8sFiles.length > 0) {
      evidence.push(...k8sFiles.map((file) => file.path));
    }

    const hasManifestContent = result.files.some((file) => file.path.endsWith('.yaml') || file.path.endsWith('.yml'));
    if (hasManifestContent) {
      const manifestFile = result.files.find((file) => file.path.endsWith('.yaml') || file.path.endsWith('.yml'));
      if (manifestFile) {
        evidence.push(`manifest: ${manifestFile.path}`);
      }
    }

    if (evidence.length < 1) {
      return null;
    }

    return createInfrastructureResult('Kubernetes', evidence, 0.8);
  },
};
