import type { ProjectScanResult } from '../types/ProjectScanResult.js';

export interface PipelineStage {
  execute(result: ProjectScanResult): Promise<ProjectScanResult>;
}
