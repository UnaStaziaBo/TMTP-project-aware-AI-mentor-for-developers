import { detectInfrastructure } from '../infrastructure/detectInfrastructure.js';
import type { PipelineStage } from '../pipeline/PipelineStage.js';
import type { ProjectScanResult } from '../types/ProjectScanResult.js';

export class InfrastructureStage implements PipelineStage {
  async execute(result: ProjectScanResult): Promise<ProjectScanResult> {
    return {
      ...result,
      infrastructure: detectInfrastructure(result),
    };
  }
}
