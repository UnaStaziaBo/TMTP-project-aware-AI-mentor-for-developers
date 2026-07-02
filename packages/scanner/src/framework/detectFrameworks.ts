import { FastAPIDetector } from './detectors/FastAPIDetector.js';
import { DjangoDetector } from './detectors/DjangoDetector.js';
import { ReactDetector } from './detectors/ReactDetector.js';
import { NestJSDetector } from './detectors/NestJSDetector.js';
import { SpringBootDetector } from './detectors/SpringBootDetector.js';
import { runFrameworkDetectors } from './registry.js';
import type { ProjectScanResult } from '../types/ProjectScanResult.js';
import type { DetectedFramework } from '../types/DetectedFramework.js';

const detectors = [
  FastAPIDetector,
  DjangoDetector,
  ReactDetector,
  NestJSDetector,
  SpringBootDetector,
];

export function detectFrameworks(result: ProjectScanResult): DetectedFramework[] {
  return runFrameworkDetectors(detectors, result);
}
