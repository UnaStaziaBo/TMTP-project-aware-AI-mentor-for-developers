import { detectDependencies } from '../dependencies/detectDependencies.js';
import type { PipelineStage } from '../pipeline/PipelineStage.js';
import type { ProjectScanResult } from '../types/ProjectScanResult.js';

export class DependencyStage implements PipelineStage {
  async execute(result: ProjectScanResult): Promise<ProjectScanResult> {
    return {
      ...result,
      dependencies: detectDependencies(result),
    };
  }
}
