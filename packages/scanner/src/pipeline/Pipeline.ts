import type { PipelineStage } from './PipelineStage.js';
import type { ProjectScanResult } from '../types/ProjectScanResult.js';

export class Pipeline {
  constructor(private readonly stages: PipelineStage[]) {}

  async execute(initialResult: ProjectScanResult): Promise<ProjectScanResult> {
    let result = initialResult;

    for (const stage of this.stages) {
      result = await stage.execute(result);
    }

    return result;
  }
}
