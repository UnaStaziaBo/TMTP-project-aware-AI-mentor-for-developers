import { DockerDetector } from './detectors/DockerDetector.js';
import { DockerComposeDetector } from './detectors/DockerComposeDetector.js';
import { KubernetesDetector } from './detectors/KubernetesDetector.js';
import { GitHubActionsDetector } from './detectors/GitHubActionsDetector.js';
import { TerraformDetector } from './detectors/TerraformDetector.js';
import { DevContainerDetector } from './detectors/DevContainerDetector.js';
import { NginxDetector } from './detectors/NginxDetector.js';
import { runInfrastructureDetectors } from './registry.js';
import type { DetectedInfrastructure } from '../types/DetectedInfrastructure.js';
import type { ProjectScanResult } from '../types/ProjectScanResult.js';

const detectors = [
  DockerDetector,
  DockerComposeDetector,
  KubernetesDetector,
  GitHubActionsDetector,
  TerraformDetector,
  DevContainerDetector,
  NginxDetector,
];

export function detectInfrastructure(result: ProjectScanResult): DetectedInfrastructure[] {
  return runInfrastructureDetectors(detectors, result);
}
