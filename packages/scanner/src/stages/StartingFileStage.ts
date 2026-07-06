import { detectStartingFiles } from '../startingFiles/detectStartingFiles.js';
import type { PipelineStage } from '../pipeline/PipelineStage.js';
import type { ProjectScanResult } from '../types/ProjectScanResult.js';

export class StartingFileStage implements PipelineStage {
  constructor(private readonly projectPath: string) {}

  async execute(result: ProjectScanResult): Promise<ProjectScanResult> {
    return {
      ...result,
      startingFiles: await detectStartingFiles(this.projectPath, result),
    };
  }
}
