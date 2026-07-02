import { PydanticDetector } from './detectors/PydanticDetector.js';
import { SQLAlchemyDetector } from './detectors/SQLAlchemyDetector.js';
import { ReactRouterDetector } from './detectors/ReactRouterDetector.js';
import { AxiosDetector } from './detectors/AxiosDetector.js';
import { JWTDetector } from './detectors/JWTDetector.js';
import { DjangoRestFrameworkDetector } from './detectors/DjangoRestFrameworkDetector.js';
import { SpringSecurityDetector } from './detectors/SpringSecurityDetector.js';
import { runDependencyDetectors } from './registry.js';
import type { DetectedDependency } from '../types/DetectedDependency.js';
import type { ProjectScanResult } from '../types/ProjectScanResult.js';

const detectors = [
  PydanticDetector,
  SQLAlchemyDetector,
  ReactRouterDetector,
  AxiosDetector,
  JWTDetector,
  DjangoRestFrameworkDetector,
  SpringSecurityDetector,
];

export function detectDependencies(result: ProjectScanResult): DetectedDependency[] {
  return runDependencyDetectors(detectors, result);
}
