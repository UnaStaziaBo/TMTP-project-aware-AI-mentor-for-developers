import { detectFrameworks } from '../framework/detectFrameworks.js';
import type { PipelineStage } from '../pipeline/PipelineStage.js';
import type { ProjectScanResult } from '../types/ProjectScanResult.js';

export class FrameworkStage implements PipelineStage {
  async execute(result: ProjectScanResult): Promise<ProjectScanResult> {
    return {
      ...result,
      frameworks: detectFrameworks(result),
    } as ProjectScanResult;
  }
}
